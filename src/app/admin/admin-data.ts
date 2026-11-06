import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Timestamp, Transaction, addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { AboutInfo, Certificate, DEFAULT_ABOUT, Engagement } from '../core/about';
import { Announcement } from '../core/announcements';
import { AuditAction, AuditEntry, describeChanges, trimDetail } from '../core/audit';
import { db, firebaseConfig } from '../core/firebase';
import { Invoice, buildInvoice, counterAfterDelete, invoiceNumber } from '../core/invoice';
import { Company, PaymentMode, ProLine, amountInWords, computePro } from '../core/pro-invoice';
import { Lot, LotInput, lotNumber } from '../core/lots';
import { DEFAULT_ORDERING, OrderingRules } from '../core/ordering';
import { Auth } from './auth';
import { Role } from './roles';
import {
  Category, DEFAULT_CATEGORIES, DEFAULT_FRIDGE, DEFAULT_SETTINGS, FridgeItem, Offer, Order, OrderItem, OrderStatus, Product, Settings,
  byOrder, formatNumber, itemQty, moveCountryStock, orderRef, originsOf, poolOf, readFridge, roundStock, stockShortages,
} from '../core/data';

type Col = 'products' | 'offers' | 'orders';

const AUDIT_LIMIT = 2000;
const COL_ACTION: Record<Col, 'product' | 'offer' | 'order'> = { products: 'product', offers: 'offer', orders: 'order' };

/** Refus normal, à expliquer à l'équipe : ce n'est pas une panne de Firebase */
class StockError extends Error {}

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
  private readonly auth = inject(Auth);
  readonly orders = signal<Order[]>([]);
  readonly newOrders = computed(() => this.orders().filter(o => o.status === 'nouveau').length);
  readonly toast = signal('');
  /** Produits et paramètres en direct, pour les alertes */
  readonly products = signal<Product[]>([]);
  readonly settings = signal<Settings>(DEFAULT_SETTINGS);
  readonly ordering = signal<OrderingRules>(DEFAULT_ORDERING);
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
      if (e instanceof StockError) {
        this.notify(e.message, 10000);
        throw e;
      }
      const text = `Échec de l'enregistrement : ${e instanceof Error ? e.message : e}`;
      this.lastError.set(text);
      this.notify(text, 8000);
      throw new Error(text);
    }
  }

  /** Ajoute une ligne au journal. Une panne du journal ne doit jamais bloquer le travail en boutique. */
  async audit(action: AuditAction, target: string, detail = '') {
    const user = this.auth.user();
    if (!user) return;
    try {
      await addDoc(collection(db, 'audit'), {
        at: serverTimestamp(), uid: user.uid, email: user.email ?? '', role: this.auth.role() ?? '', action, target, detail: trimDetail(detail),
      });
    } catch (e) {
      console.warn('Journal d\'audit non enregistré', action, e);
      this.lastError.set('Journal d\'audit non enregistré : publiez les règles Firebase.');
    }
  }

  async listAudit(from: Date, to: Date): Promise<{ entries: AuditEntry[]; capped: boolean }> {
    const snap = await getDocs(query(collection(db, 'audit'), where('at', '>=', from), where('at', '<=', to), orderBy('at', 'desc'), limit(AUDIT_LIMIT)));
    const entries = snap.docs.map(d => {
      const data = d.data();
      return { ...data, id: d.id, at: (data['at'] as Timestamp | null)?.toDate() ?? new Date() } as AuditEntry;
    });
    return { entries, capped: snap.size >= AUDIT_LIMIT };
  }

  private productName(id: string) {
    return this.products().find(p => p.id === id)?.name_fr ?? id;
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
        doc(db, 'settings', 'ordering'),
        snap => this.ordering.set({ ...DEFAULT_ORDERING, ...(snap.data() as Partial<OrderingRules> | undefined) }),
        this.watchFailed('horaires'),
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
  async save(col: Col, id: string | null, data: object) {
    const before = col === 'products' && id ? this.products().find(p => p.id === id) : undefined;
    const result = await this.guarded<unknown>(id ? setDoc(doc(db, col, id), data) : addDoc(collection(db, col), data));
    const name = (data as { name_fr?: string }).name_fr ?? id ?? '';
    this.audit(`${COL_ACTION[col]}.${before || (id && col !== 'products') ? 'updated' : 'created'}`, name, before ? describeChanges(before, data) : '');
    return result;
  }

  async update(col: Col, id: string, data: object) {
    const before = col === 'products' ? this.products().find(p => p.id === id) : undefined;
    await this.guarded(updateDoc(doc(db, col, id), data));
    this.audit(`${COL_ACTION[col]}.updated`, col === 'products' ? this.productName(id) : id, describeChanges(before, data));
  }

  async remove(col: Col, id: string) {
    const name = col === 'products' ? this.productName(id) : id;
    await this.guarded(deleteDoc(doc(db, col, id)));
    this.audit(`${COL_ACTION[col]}.deleted`, name);
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
      this.audit('order.status', orderRef(o.id), `${o.name} · ${o.status} → ${status}`);
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
    this.audit('order.status', orderRef(o.id), `${o.name} · ${o.status} → ${status} · ${deduct ? 'stock retiré' : 'stock remis'}`);
    return patch.invoiceId ?? o.invoiceId;
  }

  /** Retire (sign -1) ou remet (sign +1) des articles en stock, dans la transaction en cours. */
  private moveStock(tx: Transaction, items: OrderItem[], sign: number, products: Product[], fridge: FridgeItem[]) {
    const short = sign < 0 ? stockShortages(items, products, fridge) : [];
    if (short.length) {
      const detail = short.map(l => `${l.name} : il reste ${roundStock(l.have)} ${l.unit}, il en faut ${l.need} ${l.unit}`).join(' · ');
      throw new StockError(`Stock insuffisant. ${detail}. Réduisez la commande ou enregistrez un arrivage.`);
    }
    const pools = new Map<string, number>();
    let list = fridge;
    const ownOrigins = new Map<string, ReturnType<typeof originsOf>>();
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) continue;
      const pool = poolOf(product, fridge);
      const qty = sign * itemQty(item);
      if (pool) {
        pools.set(pool.id, (pools.get(pool.id) ?? 0) + qty);
        if (item.origin && pool.countries) {
          list = list.map(f => (f.id === pool.id ? { ...f, countries: moveCountryStock(f.countries, item.origin!, qty) } : f));
        }
      } else if (product.trackStock) {
        const origins = ownOrigins.get(product.id) ?? originsOf(product);
        const counted = origins.some(o => o.country === item.origin && o.stock !== undefined);
        const next = counted ? origins.map(o => (o.country === item.origin ? { ...o, stock: Math.max(0, roundStock((o.stock ?? 0) + qty)) } : o)) : origins;
        if (counted) ownOrigins.set(product.id, next);
        tx.update(doc(db, 'products', product.id), { stock: increment(qty), ...(counted ? { origins: next } : {}) });
      }
    }
    if (pools.size) {
      tx.update(doc(db, 'settings', 'fridge'), { list: list.map(f => ({ ...f, kg: roundStock(f.kg + (pools.get(f.id) ?? 0)) })) });
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
    this.audit('invoice.created', input.client.name, `${formatNumber(totals.ttc)} DA TTC · stock ${input.deductStock ? 'retiré' : 'non touché'}`);
    return invoiceRef.id;
  }

  async setPaid(inv: Invoice, paid: number) {
    await this.guarded(updateDoc(doc(db, 'invoices', inv.id), { 'pro.paid': paid }));
    this.audit('invoice.paid', inv.number, `${inv.customer.name} · encaissé : ${inv.pro?.paid ?? 0} → ${paid} DA`);
  }

  /** Une facture émise n'est jamais supprimée : elle est annulée, et son stock revient. */
  async cancelProInvoice(inv: Invoice) {
    const products = inv.pro?.stockDeducted ? await this.list<Product>('products') : [];
    const fridgeRef = doc(db, 'settings', 'fridge');
    await this.guarded(runTransaction(db, async tx => {
      const snap = await tx.get(fridgeRef);
      if (inv.pro?.stockDeducted) {
        this.moveStock(tx, proItems(inv.pro.lines), 1, products, snap.exists() ? readFridge(snap.data()['list']) : []);
      }
      tx.update(doc(db, 'invoices', inv.id), { status: 'annulée' });
    }));
    this.audit('invoice.cancelled', inv.number, `${inv.customer.name} · ${formatNumber(inv.total)} DA`);
  }

  /**
   * Supprime une commande et son suivi. Si elle avait été confirmée, son poids revient en stock
   * et sa facture passe en annulée.
   */
  async deleteOrder(o: Order) {
    const products = o.stockDone ? await this.list<Product>('products') : [];
    const fridgeRef = doc(db, 'settings', 'fridge');
    const invoiceRef = o.invoiceId ? doc(db, 'invoices', o.invoiceId) : null;
    await this.guarded(runTransaction(db, async tx => {
      const snap = await tx.get(fridgeRef);
      const invoice = invoiceRef ? await tx.get(invoiceRef) : null;
      if (o.stockDone) this.moveStock(tx, o.items ?? [], 1, products, snap.exists() ? readFridge(snap.data()['list']) : []);
      if (invoiceRef && invoice?.exists()) tx.update(invoiceRef, { status: 'annulée' });
      tx.delete(doc(db, 'orders', o.id));
      tx.delete(doc(db, 'tracking', o.id));
    }));
    this.audit('order.deleted', orderRef(o.id), `${o.name} · ${o.tel} · ${o.status}${o.total !== undefined ? ` · ${formatNumber(o.total)} DA` : ''}${o.stockDone ? ' · stock remis' : ''}`);
  }

  /** Supprime une facture sans laisser de trou dans la numérotation quand c'est la dernière. */
  async deleteInvoice(inv: Invoice, others: Invoice[]) {
    const restore = !!inv.pro?.stockDeducted && inv.status !== 'annulée';
    const products = restore ? await this.list<Product>('products') : [];
    const counterRef = doc(db, 'settings', 'invoiceCounter');
    const fridgeRef = doc(db, 'settings', 'fridge');
    const orderDoc = inv.orderId ? doc(db, 'orders', inv.orderId) : null;
    await this.guarded(runTransaction(db, async tx => {
      const counter = await tx.get(counterRef);
      const fridge = await tx.get(fridgeRef);
      const order = orderDoc ? await tx.get(orderDoc) : null;
      const year = Number(inv.number.split('-')[1]);
      const next = counterAfterDelete(inv.number, others.map(i => i.number), counter.data()?.[year] ?? 0);
      if (restore) this.moveStock(tx, proItems(inv.pro!.lines), 1, products, fridge.exists() ? readFridge(fridge.data()['list']) : []);
      if (next) tx.set(counterRef, { [next.year]: next.value }, { merge: true });
      if (orderDoc && order?.exists()) tx.update(orderDoc, { invoiceId: deleteField() });
      // Une commande déjà supprimée n'a plus besoin de sa fiche de suivi
      else if (inv.orderId) tx.delete(doc(db, 'tracking', inv.orderId));
      tx.delete(doc(db, 'invoices', inv.id));
    }));
    this.audit('invoice.deleted', inv.number, `${inv.customer.name} · ${formatNumber(inv.total)} DA · ${inv.status}`);
  }

  async listCompanies(): Promise<Company[]> {
    const snap = await getDocs(collection(db, 'companies'));
    return snap.docs.map(d => ({ ...d.data(), id: d.id }) as Company).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Crée ou met à jour un client et renvoie son identifiant. */
  async saveCompany(id: string | null, data: Omit<Company, 'id'>): Promise<string> {
    const saved = id ?? doc(collection(db, 'companies')).id;
    await this.guarded(setDoc(doc(db, 'companies', saved), data));
    this.audit('company.updated', data.name);
    return saved;
  }

  async removeCompany(id: string) {
    await this.guarded(deleteDoc(doc(db, 'companies', id)));
    this.audit('company.deleted', id);
  }

  async listAnnouncements(): Promise<Announcement[]> {
    const snap = await getDocs(collection(db, 'announcements'));
    return snap.docs.map(d => ({ ...d.data(), id: d.id }) as Announcement).sort((a, b) => b.start.localeCompare(a.start));
  }

  async addAnnouncement(data: Omit<Announcement, 'id'>): Promise<string> {
    const id = (await this.guarded(addDoc(collection(db, 'announcements'), data))).id;
    this.audit('announcement.created', data.title_fr, `du ${data.start} au ${data.end}`);
    return id;
  }

  async removeAnnouncement(id: string) {
    await this.guarded(deleteDoc(doc(db, 'announcements', id)));
    this.audit('announcement.deleted', id);
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
      this.audit('member.created', email, `rôle : ${role}`);
    } finally {
      await deleteApp(app);
    }
  }

  async setMemberRole(m: Member, role: Role) {
    await this.guarded(updateDoc(doc(db, 'admins', m.uid), { role }));
    this.audit('member.role', m.email, `${m.role} → ${role}`);
  }

  /** Retire l'accès à l'admin. Le compte Firebase reste, sans aucun droit. */
  async removeMember(m: Member) {
    await this.guarded(deleteDoc(doc(db, 'admins', m.uid)));
    this.audit('member.deleted', m.email, `rôle : ${m.role}`);
  }

  /** Les rayons sont une liste dans settings/categories : déjà couvert par firestore.rules. */
  async getCategories(): Promise<Category[]> {
    const snap = await getDoc(doc(db, 'settings', 'categories'));
    return structuredClone(snap.exists() ? (snap.data()['list'] as Category[]) : DEFAULT_CATEGORIES).sort(byOrder);
  }

  async saveCategories(list: Category[]) {
    await this.guarded(setDoc(doc(db, 'settings', 'categories'), { list }));
    this.audit('categories.updated', 'Rayons', list.map(c => c.name_fr).join(', '));
  }

  async saveFridge(list: FridgeItem[]) {
    const before = this.fridge();
    await this.guarded(setDoc(doc(db, 'settings', 'fridge'), { list }));
    const changes = list.map(f => {
      const text = describeChanges(before.find(b => b.id === f.id), f);
      return text && `${f.name} : ${text}`;
    }).filter(Boolean);
    this.audit('fridge.updated', 'Frigo', changes.join(' | '));
  }

  async listLots(): Promise<Lot[]> {
    const snap = await getDocs(query(collection(db, 'lots'), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ ...d.data(), id: d.id }) as Lot);
  }

  private async fridgeInTx(tx: Transaction) {
    const snap = await tx.get(doc(db, 'settings', 'fridge'));
    return snap.exists() ? readFridge(snap.data()['list']) : this.fridge();
  }

  private async lotProduct(tx: Transaction, lot: LotInput) {
    if (lot.target.kind !== 'product' || !lot.origin) return undefined;
    const snap = await tx.get(doc(db, 'products', lot.target.id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as Product) : undefined;
  }

  /** Ajoute (qty > 0) ou retire (qty < 0) la quantité d'un arrivage. */
  private moveLot(tx: Transaction, lot: LotInput, qty: number, fridge: FridgeItem[], product?: Product) {
    const arrival = qty > 0;
    if (lot.target.kind === 'product') {
      const origins = lot.origin && product ? originsOf(product) : [];
      const known = origins.some(o => o.country === lot.origin);
      const next = known
        ? origins.map(o => (o.country === lot.origin ? { ...o, stock: Math.max(0, roundStock((o.stock ?? 0) + qty)) } : o))
        : lot.origin ? [...origins, { country: lot.origin, price: product?.price ?? 0, stock: Math.max(0, qty) }] : [];
      tx.update(doc(db, 'products', lot.target.id), { stock: increment(qty), ...(arrival ? { restockDate: '' } : {}), ...(lot.origin ? { origins: next } : {}) });
      return;
    }
    const list = fridge.map(f => {
      if (f.id !== lot.target.id) return f;
      const { restockDate, ...rest } = f;
      return {
        ...(arrival ? rest : f), kg: Math.max(0, roundStock(f.kg + qty)),
        ...(lot.origin ? { countries: moveCountryStock(f.countries, lot.origin, qty) } : {}),
      };
    });
    tx.set(doc(db, 'settings', 'fridge'), { list });
  }

  /** Enregistre un arrivage, lui attribue son matricule et met le stock à jour d'un seul coup. */
  async addLot(input: LotInput): Promise<string> {
    const year = Number(input.arrivalDate.slice(0, 4));
    const counterRef = doc(db, 'settings', 'lotCounter');
    const lotRef = doc(collection(db, 'lots'));
    const created = await this.guarded(runTransaction(db, async tx => {
      const counter = await tx.get(counterRef);
      const fridge = await this.fridgeInTx(tx);
      const product = await this.lotProduct(tx, input);
      const next = (counter.data()?.[year] ?? 0) + 1;
      const matricule = lotNumber(year, next);
      tx.set(counterRef, { [year]: next }, { merge: true });
      tx.set(lotRef, { ...input, matricule, createdAt: serverTimestamp() });
      this.moveLot(tx, input, input.qty, fridge, product);
      return matricule;
    }));
    this.audit('lot.created', created, `${input.target.name} · ${input.qty} ${input.target.unit}${input.origin ? ` · ${input.origin}` : ''} · ${input.supplierName} · réf. ${input.supplierRef}`);
    return created;
  }

  /** Un arrivage annulé reste dans l'historique : son matricule n'est jamais réutilisé. */
  async cancelLot(lot: Lot) {
    const lotRef = doc(db, 'lots', lot.id);
    await this.guarded(runTransaction(db, async tx => {
      const snap = await tx.get(lotRef);
      if (snap.data()?.['cancelled']) throw new Error('Cet arrivage est déjà annulé.');
      const fridge = await this.fridgeInTx(tx);
      const product = await this.lotProduct(tx, lot);
      this.moveLot(tx, lot, -lot.qty, fridge, product);
      tx.update(lotRef, { cancelled: true });
    }));
    this.audit('lot.cancelled', lot.matricule, `${lot.target.name} · ${lot.qty} ${lot.target.unit}`);
  }

  async getAbout() {
    const [about, gallery, certificates] = await Promise.all(['about', 'gallery', 'certificates'].map(id => getDoc(doc(db, 'settings', id))));
    return {
      engagements: ({ ...DEFAULT_ABOUT, ...(about.data() as Partial<AboutInfo> | undefined) }).engagements,
      photos: (gallery.data()?.['list'] ?? []) as string[],
      certificates: (certificates.data()?.['list'] ?? []) as Certificate[],
    };
  }

  /** Les images ont leurs propres documents : le texte reste léger pour chaque visite. */
  async saveAbout(photos: string[], engagements: Engagement[], certificates: Certificate[]) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'settings', 'about'), { engagements, photos: photos.length, certificates: certificates.length });
    batch.set(doc(db, 'settings', 'gallery'), { list: photos });
    batch.set(doc(db, 'settings', 'certificates'), { list: certificates });
    await this.guarded(batch.commit());
    this.audit('settings.updated', 'Notre boucherie', `${photos.length} photo(s) · ${engagements.length} engagement(s) · ${certificates.length} certificat(s)`);
  }

  async saveOrdering(data: Partial<OrderingRules>) {
    const before = this.ordering();
    await this.guarded(setDoc(doc(db, 'settings', 'ordering'), data, { merge: true }));
    this.audit('ordering.updated', 'Commandes', describeChanges(before, data));
  }

  async saveSettings(s: Settings) {
    const before = this.settings();
    await this.guarded(setDoc(doc(db, 'settings', 'main'), s));
    this.audit('settings.updated', 'Paramètres', describeChanges(before, s));
  }
}
