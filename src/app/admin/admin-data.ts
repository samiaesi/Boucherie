import { Injectable, computed, signal } from '@angular/core';
import {
  Transaction, addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { db, firebaseConfig } from '../core/firebase';
import { Invoice, buildInvoice, invoiceNumber } from '../core/invoice';
import { Company, PaymentMode, ProLine, amountInWords, computePro } from '../core/pro-invoice';
import { Role } from './roles';
import {
  Category, DEFAULT_CATEGORIES, DEFAULT_FRIDGE, DEFAULT_SETTINGS, FridgeItem, Offer, Order, OrderItem, OrderStatus, Product, Settings,
  byOrder, itemQty, orderRef, poolOf, readFridge, roundStock,
} from '../core/data';

type Col = 'products' | 'offers' | 'orders';

/** Lignes d'une facture pro, sous la forme attendue par le stock */
const proItems = (lines: ProLine[]): OrderItem[] => lines.filter(l => l.productId).map(l => (l.unit === 'kg'
  ? { productId: l.productId, unit: 'kg', grams: l.qty * 1000, qty: 1 }
  : { productId: l.productId, unit: 'piece', qty: l.qty }));

export interface Member {
  uid: string;
  email: string;
  role: Role;
}

/** Accès en écriture à Firestore pour l'espace admin. */
@Injectable({ providedIn: 'root' })
export class AdminData {
  readonly orders = signal<Order[]>([]);
  readonly newOrders = computed(() => this.orders().filter(o => o.status === 'nouveau').length);
  readonly toast = signal('');
  /** Produits et paramètres en direct, pour les alertes */
  readonly products = signal<Product[]>([]);
  readonly settings = signal<Settings>(DEFAULT_SETTINGS);
  readonly fridge = signal<FridgeItem[]>(DEFAULT_FRIDGE);
  /** Dernière erreur Firebase, effacée à la prochaine écriture réussie */
  readonly lastError = signal('');
  /** Vrai quand commandes, produits et paramètres sont arrivés */
  readonly ready = computed(() => this.loaded().size === 4);
  private readonly loaded = signal(new Set<string>());
  private stops: (() => void)[] = [];

  notify(text: string, ms = 2500) {
    this.toast.set(text);
    setTimeout(() => this.toast() === text && this.toast.set(''), ms);
  }

  /** Une écriture refusée ne doit jamais passer inaperçue. */
  private async guarded<T>(write: Promise<T>): Promise<T> {
    try {
      const result = await write;
      this.lastError.set('');
      return result;
    } catch (e) {
      const text = `Échec de l'enregistrement : ${e instanceof Error ? e.message : e}`;
      this.lastError.set(text);
      this.notify(text, 8000);
      throw new Error(text);
    }
  }

  private markLoaded(name: string) {
    this.loaded.update(all => new Set(all).add(name));
  }

  private watchFailed(what: string) {
    return (err: Error) => {
      this.lastError.set(`${what} : ${err.message}`);
      this.notify(`Erreur ${what} : ${err.message}`, 8000);
    };
  }

  /** Commandes, produits et paramètres en temps réel, pour toute la durée de la session admin. */
  watchAll() {
    this.unwatchAll();
    this.stops = [
      onSnapshot(
        query(collection(db, 'orders'), orderBy('createdAt', 'desc')),
        snap => {
          this.orders.set(snap.docs.map(d => {
            const data = d.data();
            return { ...data, id: d.id, createdAt: data['createdAt']?.toDate() } as Order;
          }));
          this.markLoaded('orders');
          document.title = this.newOrders() ? `(${this.newOrders()}) Commandes` : 'Administration';
        },
        this.watchFailed('commandes'),
      ),
      onSnapshot(
        collection(db, 'products'),
        snap => {
          this.products.set(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Product).sort(byOrder));
          this.markLoaded('products');
        },
        this.watchFailed('produits'),
      ),
      onSnapshot(
        doc(db, 'settings', 'main'),
        snap => {
          this.settings.set({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<Settings> | undefined) });
          this.markLoaded('settings');
        },
        this.watchFailed('paramètres'),
      ),
      onSnapshot(
        doc(db, 'settings', 'fridge'),
        snap => {
          this.fridge.set(snap.exists() ? readFridge(snap.data()['list']) : DEFAULT_FRIDGE);
          this.markLoaded('fridge');
        },
        this.watchFailed('frigo'),
      ),
    ];
  }

  unwatchAll() {
    this.stops.forEach(stop => stop());
    this.stops = [];
    this.loaded.set(new Set());
    this.orders.set([]);
  }

  async list<T extends Product | Offer>(col: 'products' | 'offers'): Promise<T[]> {
    const snap = await getDocs(collection(db, col));
    return snap.docs.map(d => ({ ...d.data(), id: d.id }) as T).sort(byOrder);
  }

  /** Crée (id vide) ou remplace un document. */
  save(col: Col, id: string | null, data: object) {
    return this.guarded<unknown>(id ? setDoc(doc(db, col, id), data) : addDoc(collection(db, col), data));
  }

  update(col: Col, id: string, data: object) {
    return this.guarded(updateDoc(doc(db, col, id), data));
  }

  remove(col: Col, id: string) {
    return this.guarded(deleteDoc(doc(db, col, id)));
  }

  async getSettings(): Promise<Settings> {
    const snap = await getDoc(doc(db, 'settings', 'main'));
    return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<Settings> | undefined) };
  }

  /**
   * Change le statut d'une commande et tient le stock à jour :
   * déduit à la confirmation, remis en stock si la commande est annulée.
   */
  async changeStatus(o: Order, status: OrderStatus): Promise<string | undefined> {
    const deduct = !o.stockDone && status !== 'nouveau' && status !== 'annulé';
    const restore = !!o.stockDone && status === 'annulé';
    const patch: Partial<Order> = { status };
    const trackRef = doc(db, 'tracking', o.id);
    // Écrit à chaque changement : les commandes d'avant le suivi obtiennent ainsi leur fiche
    const track = {
      status, delivery: o.type === 'livraison', date: o.date, ref: orderRef(o.id), steps: { [status]: serverTimestamp() },
    };
    if (!deduct && !restore) {
      const batch = writeBatch(db);
      batch.update(doc(db, 'orders', o.id), patch);
      batch.set(trackRef, track, { merge: true });
      await this.guarded(batch.commit());
      return o.invoiceId;
    }

    patch.stockDone = deduct;
    const sign = deduct ? -1 : 1;
    const products = await this.list<Product>('products');
    const fridgeRef = doc(db, 'settings', 'fridge');
    const counterRef = doc(db, 'settings', 'invoiceCounter');
    // Les anciennes commandes n'ont pas de montants : pas de facture pour elles
    const invoiceRef = deduct && !o.invoiceId && o.total !== undefined ? doc(collection(db, 'invoices')) : null;
    if (invoiceRef) patch.invoiceId = invoiceRef.id;

    // En transaction : deux confirmations simultanées ne doivent ni s'écraser ni partager un numéro de facture
    await this.guarded(runTransaction(db, async tx => {
      const snap = await tx.get(fridgeRef);
      const counter = invoiceRef ? await tx.get(counterRef) : null;
      const fridge = snap.exists() ? readFridge(snap.data()['list']) : [];
      this.moveStock(tx, o.items ?? [], sign, products, fridge);
      if (invoiceRef) {
        const now = new Date(), year = now.getFullYear();
        const next = (counter?.data()?.[year] ?? 0) + 1;
        tx.set(counterRef, { [year]: next }, { merge: true });
        const date = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        tx.set(invoiceRef, { ...buildInvoice(o, this.settings(), invoiceNumber(year, next), date), createdAt: serverTimestamp() });
      }
      if (restore && o.invoiceId) tx.update(doc(db, 'invoices', o.invoiceId), { status: 'annulée' });
      tx.update(doc(db, 'orders', o.id), patch);
      tx.set(trackRef, track, { merge: true });
    }));
    return patch.invoiceId ?? o.invoiceId;
  }

  /** Retire (sign -1) ou remet (sign +1) des articles en stock, dans la transaction en cours. */
  private moveStock(tx: Transaction, items: OrderItem[], sign: number, products: Product[], fridge: FridgeItem[]) {
    const pools = new Map<string, number>();
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) continue;
      const pool = poolOf(product, fridge);
      if (pool) pools.set(pool.id, (pools.get(pool.id) ?? 0) + sign * itemQty(item));
      else if (product.trackStock) tx.update(doc(db, 'products', product.id), { stock: increment(sign * itemQty(item)) });
    }
    if (pools.size) {
      tx.update(doc(db, 'settings', 'fridge'), { list: fridge.map(f => ({ ...f, kg: roundStock(f.kg + (pools.get(f.id) ?? 0)) })) });
    }
  }

  /** Émet une facture d'entreprise. Même numérotation que les factures clients. */
  async createProInvoice(input: {
    client: Omit<Company, 'id'>; lines: ProLine[]; discountRate: number; payment: PaymentMode;
    date: string; dueDate: string; deductStock: boolean;
  }): Promise<string> {
    const s = this.settings();
    const totals = computePro(input.lines, input.discountRate, input.payment, s.stampRate);
    const invoiceRef = doc(collection(db, 'invoices'));
    const counterRef = doc(db, 'settings', 'invoiceCounter');
    const fridgeRef = doc(db, 'settings', 'fridge');
    const products = input.deductStock ? await this.list<Product>('products') : [];
    await this.guarded(runTransaction(db, async tx => {
      const counter = await tx.get(counterRef);
      const snap = await tx.get(fridgeRef);
      const fridge = snap.exists() ? readFridge(snap.data()['list']) : [];
      if (input.deductStock) this.moveStock(tx, proItems(input.lines), -1, products, fridge);
      const year = Number(input.date.slice(0, 4));
      const next = (counter.data()?.[year] ?? 0) + 1;
      tx.set(counterRef, { [year]: next }, { merge: true });
      tx.set(invoiceRef, {
        number: invoiceNumber(year, next), orderId: '', status: 'émise', date: input.date, lang: 'fr',
        customer: { name: input.client.name, tel: input.client.tel }, delivery: false, lines: [],
        subtotal: totals.totalHt, deliveryFee: 0, total: totals.ttc, vatRate: 0,
        seller: { name: s.name_fr, company: s.company, address: s.address_fr, phone: s.phone, nif: s.nif, nis: s.nis, rc: s.rc, ai: s.ai },
        pro: {
          ...totals, client: input.client, lines: input.lines, discountRate: input.discountRate, payment: input.payment,
          dueDate: input.dueDate, paid: 0, stockDeducted: input.deductStock, amountWords: amountInWords(totals.ttc),
        },
        createdAt: serverTimestamp(),
      });
    }));
    return invoiceRef.id;
  }

  setPaid(inv: Invoice, paid: number) {
    return this.guarded(updateDoc(doc(db, 'invoices', inv.id), { 'pro.paid': paid }));
  }

  /** Une facture émise n'est jamais supprimée : elle est annulée, et son stock revient. */
  async cancelProInvoice(inv: Invoice) {
    const products = inv.pro?.stockDeducted ? await this.list<Product>('products') : [];
    const fridgeRef = doc(db, 'settings', 'fridge');
    return this.guarded(runTransaction(db, async tx => {
      const snap = await tx.get(fridgeRef);
      if (inv.pro?.stockDeducted) {
        this.moveStock(tx, proItems(inv.pro.lines), 1, products, snap.exists() ? readFridge(snap.data()['list']) : []);
      }
      tx.update(doc(db, 'invoices', inv.id), { status: 'annulée' });
    }));
  }

  async listCompanies(): Promise<Company[]> {
    const snap = await getDocs(collection(db, 'companies'));
    return snap.docs.map(d => ({ ...d.data(), id: d.id }) as Company).sort((a, b) => a.name.localeCompare(b.name));
  }

  saveCompany(id: string | null, data: Omit<Company, 'id'>) {
    return this.guarded<unknown>(id ? setDoc(doc(db, 'companies', id), data) : addDoc(collection(db, 'companies'), data));
  }

  removeCompany(id: string) {
    return this.guarded(deleteDoc(doc(db, 'companies', id)));
  }

  async listInvoices(): Promise<Invoice[]> {
    const snap = await getDocs(query(collection(db, 'invoices'), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ ...d.data(), id: d.id }) as Invoice);
  }

  async listMembers(): Promise<Member[]> {
    const snap = await getDocs(collection(db, 'admins'));
    return snap.docs.map(d => ({ uid: d.id, email: d.data()['email'] ?? '', role: d.data()['role'] ?? 'admin' }));
  }

  /** Une seconde connexion Firebase : créer un compte ne doit pas déconnecter l'administrateur. */
  async addMember(email: string, password: string, role: Role) {
    const app = initializeApp(firebaseConfig, `equipe-${Date.now()}`);
    try {
      const { user } = await createUserWithEmailAndPassword(getAuth(app), email, password);
      await this.guarded(setDoc(doc(db, 'admins', user.uid), { email, role }));
    } finally {
      await deleteApp(app);
    }
  }

  setMemberRole(m: Member, role: Role) {
    return this.guarded(updateDoc(doc(db, 'admins', m.uid), { role }));
  }

  /** Retire l'accès à l'admin. Le compte Firebase reste, sans aucun droit. */
  removeMember(m: Member) {
    return this.guarded(deleteDoc(doc(db, 'admins', m.uid)));
  }

  /** Les rayons sont une liste dans settings/categories : déjà couvert par firestore.rules. */
  async getCategories(): Promise<Category[]> {
    const snap = await getDoc(doc(db, 'settings', 'categories'));
    return structuredClone(snap.exists() ? (snap.data()['list'] as Category[]) : DEFAULT_CATEGORIES).sort(byOrder);
  }

  saveCategories(list: Category[]) {
    return this.guarded(setDoc(doc(db, 'settings', 'categories'), { list }));
  }

  saveFridge(list: FridgeItem[]) {
    return this.guarded(setDoc(doc(db, 'settings', 'fridge'), { list }));
  }

  saveSettings(s: Settings) {
    return this.guarded(setDoc(doc(db, 'settings', 'main'), s));
  }
}
