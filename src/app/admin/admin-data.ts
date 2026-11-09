import { slotInLabel, slotKey } from '../core/delivery-slots';
import type { Campaign } from '../core/campaigns';
import { LoyaltyCard, normalizeTel, pointsFor, validTel } from '../core/loyalty';
import { MENU_RECIPES, MenuRecipe } from '../core/menu-planner';
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
import { Lot, LotInput, lotNumber, lotParts } from '../core/lots';
import { Carcass, carcassesOf, cleanCarcass, removeOldest, sellCarcass, withCarcasses } from '../core/carcasses';
import { CutInput, CutRecord, ExitInput, StockExit, availableQty, cutNumber, cutWaste, exitLabel, exitNumber, splitRegister } from '../core/stock-chain';
import { DEFAULT_ORDERING, OrderingRules } from '../core/ordering';
import { Auth } from './auth';
import { Role } from './roles';
import {
  Category, DEFAULT_CATEGORIES, DEFAULT_FRIDGE, DEFAULT_SETTINGS, FridgeItem, Offer, Order, OrderItem, OrderStatus, Product, Settings,
  BEAST_SHARE, byOrder, carcassOf, formatNumber, isCutOf, itemQty, moveBeasts, wholeLeft, moveCountryStock, orderRef, originsOf, poolOf, readFridge, roundStock, stockShortages,
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

/** Mouvement de stock d'un arrivage, d'une sortie ou de leur annulation */
type LotMove = LotInput & { matricule?: string; back?: Carcass[] };

/** Les carcasses d'un arrivage : une par bête, avec son numéro, son poids, son pays et son prix */
function newCarcasses(lot: LotMove, qty: number): Carcass[] {
  if (lot.lines?.length) {
    return lot.lines.map((b, i) => ({ b, i })).filter(x => !lot.origin || x.b.origin === lot.origin).map(({ b, i }) => cleanCarcass({
      id: `${lot.matricule ?? 'lot'}-${i + 1}`, kg: b.kg, origin: b.origin, lot: lot.matricule, n: i + 1, price: b.price, date: lot.arrivalDate,
    }));
  }
  const n = Math.max(0, Math.floor(lot.beasts ?? 0));
  // Un lot (poulets) peut compter des centaines de bêtes : chaque carcasse garde le strict nécessaire
  return Array.from({ length: n }, (_, i) => cleanCarcass({
    id: `${lot.matricule ?? 'r' + Date.now()}-${i + 1}`, kg: roundStock(qty / n), origin: lot.origin, lot: lot.matricule,
  }));
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
    const invoiceId = await this.applyStatus(o, status);
    await this.awardPoints(o, status);
    await this.releaseSlot(o, status);
    return invoiceId;
  }

  /** Une seule fois par commande, quand elle est remise au client. Les frais de livraison ne comptent pas. */
  private async awardPoints(o: Order, status: OrderStatus) {
    const s = this.settings();
    if (!s.loyaltyEnabled || o.loyaltyDone || (status !== 'livré' && status !== 'récupéré') || !validTel(o.tel)) return;
    const points = pointsFor((o.total ?? 0) - (o.delivery ?? 0), s.loyaltyEvery);
    if (points <= 0) return;
    const orderRefDoc = doc(db, 'orders', o.id);
    const cardRef = doc(db, 'loyalty', normalizeTel(o.tel));
    try {
      await runTransaction(db, async tx => {
        const [order, card] = [await tx.get(orderRefDoc), await tx.get(cardRef)];
        if (order.data()?.['loyaltyDone']) return;
        tx.update(orderRefDoc, { loyaltyDone: true });
        tx.set(cardRef, {
          points: ((card.data()?.['points'] as number) ?? 0) + points,
          earned: ((card.data()?.['earned'] as number) ?? 0) + points,
        });
      });
      this.audit('loyalty.updated', normalizeTel(o.tel), `+${points} points · ${orderRef(o.id)}`);
    } catch (e) {
      // La commande reste valide : seuls les points manquent
      console.warn('Points de fidélité non ajoutés', e);
      this.notify('Statut mis à jour, mais les points de fidélité n\'ont pas pu être ajoutés.', 7000);
    }
  }

  async listLoyalty(): Promise<LoyaltyCard[]> {
    const snap = await getDocs(collection(db, 'loyalty'));
    return snap.docs.map(d => ({ ...d.data(), id: d.id }) as LoyaltyCard);
  }

  /** Achat au comptoir : crée la carte au besoin et ajoute les points du montant. */
  async addStorePoints(tel: string, amount: number) {
    const points = pointsFor(amount, this.settings().loyaltyEvery);
    if (points <= 0) return 0;
    const id = normalizeTel(tel), ref = doc(db, 'loyalty', id);
    await this.guarded(runTransaction(db, async tx => {
      const card = await tx.get(ref);
      tx.set(ref, {
        points: ((card.data()?.['points'] as number) ?? 0) + points,
        earned: ((card.data()?.['earned'] as number) ?? 0) + points,
      });
    }));
    this.audit('loyalty.updated', id, `+${points} points · achat en boutique ${amount} DA`);
    return points;
  }

  async adjustPoints(id: string, delta: number, reason: string) {
    const ref = doc(db, 'loyalty', id);
    await this.guarded(runTransaction(db, async tx => {
      const card = await tx.get(ref);
      const points = Math.max(0, ((card.data()?.['points'] as number) ?? 0) + delta);
      tx.set(ref, { points, earned: (card.data()?.['earned'] as number) ?? 0 });
    }));
    this.audit('loyalty.updated', id, `${delta > 0 ? '+' : ''}${delta} points · ${reason}`);
  }

  private async applyStatus(o: Order, status: OrderStatus): Promise<string | undefined> {
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
    let touched = false;
    let list = fridge;
    const ownOrigins = new Map<string, ReturnType<typeof originsOf>>();
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) continue;
      const pool = poolOf(product, fridge);
      const qty = sign * itemQty(item);
      if (pool) {
        // Une bête entière (ou une demi) quitte le frigo : la carcasse au poids le plus proche de la commande
        const share = BEAST_SHARE[carcassOf(product)!];
        const unit = itemQty(item) / Math.max(1, item.qty);
        for (let k = 0; k < item.qty; k++) {
          list = list.map(f => {
            if (f.id !== pool.id) return f;
            const current = carcassesOf(f);
            const next = sign < 0
              ? sellCarcass(current, share, item.origin, unit)
              : [...current, cleanCarcass({ id: `retour-${Date.now()}-${k}`, kg: roundStock(unit), origin: item.origin, half: share === 0.5 || undefined })];
            if (!next) throw new StockError(`Plus de ${share === 1 ? 'bête entière' : 'demi-bête'} de ${f.name}${item.origin ? ` (${item.origin})` : ''} au frigo.`);
            return withCarcasses(f, next);
          });
        }
        touched = true;
      } else if (product.trackStock || isCutOf(product, fridge)) {
        const origins = ownOrigins.get(product.id) ?? originsOf(product);
        const counted = origins.some(o => o.country === item.origin && o.stock !== undefined);
        const next = counted ? origins.map(o => (o.country === item.origin ? { ...o, stock: Math.max(0, roundStock((o.stock ?? 0) + qty)) } : o)) : origins;
        if (counted) ownOrigins.set(product.id, next);
        tx.update(doc(db, 'products', product.id), { stock: increment(qty), ...(counted ? { origins: next } : {}) });
      }
    }
    if (touched) tx.update(doc(db, 'settings', 'fridge'), { list });
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

  async getCampaigns(): Promise<Campaign[]> {
    const snap = await getDoc(doc(db, 'settings', 'reservations'));
    return snap.exists() ? structuredClone(snap.data()['list'] as Campaign[]) : [];
  }

  async saveCampaigns(list: Campaign[]) {
    await this.guarded(setDoc(doc(db, 'settings', 'reservations'), { list }));
    this.audit('reservations.updated', 'Réservations', list.map(c => c.name_fr).join(', '));
  }

  async getMenus(): Promise<MenuRecipe[]> {
    const snap = await getDoc(doc(db, 'settings', 'menus'));
    return structuredClone(snap.exists() ? (snap.data()['list'] as MenuRecipe[]) : MENU_RECIPES);
  }

  async saveMenus(list: MenuRecipe[]) {
    await this.guarded(setDoc(doc(db, 'settings', 'menus'), { list }));
    this.audit('menus.updated', 'Menus', `${list.length} menus`);
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

  /** Le registre contient les arrivages et les sorties de stock. */
  async listRegister() {
    const snap = await getDocs(query(collection(db, 'lots'), orderBy('createdAt', 'desc')));
    return splitRegister(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Lot | StockExit | CutRecord));
  }

  async listLots(): Promise<Lot[]> {
    return (await this.listRegister()).lots;
  }

  /** Retire du stock ce qui ne sera pas vendu (perte, os, retour…), avec un matricule de sortie. */
  async addExit(input: ExitInput): Promise<string> {
    const year = Number(input.date.slice(0, 4));
    const counterRef = doc(db, 'settings', 'lotCounter');
    const exitRef = doc(collection(db, 'lots'));
    const created = await this.guarded(runTransaction(db, async tx => {
      const counter = await tx.get(counterRef);
      const fridge = await this.fridgeInTx(tx);
      const product = input.target.kind === 'product' ? await this.productInTx(tx, input.target.id) : undefined;
      const left = availableQty(input.target, fridge, product ? [product] : [], input.origin);
      if (input.qty > left + 0.001) {
        throw new StockError(`Il ne reste que ${roundStock(left)} ${input.target.unit} de ${input.target.name}${input.origin ? ` (${input.origin})` : ''} : impossible d'en retirer ${input.qty}.`);
      }
      const reserve = input.target.kind === 'fridge' ? fridge.find(f => f.id === input.target.id) : undefined;
      const beastsLeft = reserve ? wholeLeft(reserve, input.origin && reserve.wholeBy ? input.origin : undefined) : 0;
      if (reserve && (input.beasts ?? 0) > beastsLeft + 0.001) {
        throw new StockError(`Il ne reste que ${beastsLeft} bête(s) entière(s) de ${reserve.name}${input.origin ? ` (${input.origin})` : ''}.`);
      }
      const key = `S${year}`;
      const next = (counter.data()?.[key] ?? 0) + 1;
      const matricule = exitNumber(year, next);
      tx.set(counterRef, { [key]: next }, { merge: true });
      const after = this.moveLot(tx, this.asLot(input), -input.qty, fridge, product);
      // Pour une réserve, ce sont de vraies carcasses qui sortent : on garde lesquelles et leur poids réel
      const removed = reserve ? carcassesOf(reserve).filter(c => !carcassesOf(after.find(f => f.id === reserve.id)!).some(x => x.id === c.id)) : [];
      const record = removed.length
        ? { ...input, qty: roundStock(removed.reduce((sum, c) => sum + c.kg, 0)), carcasses: removed.map(cleanCarcass) }
        : input;
      tx.set(exitRef, { ...record, kind: 'sortie', matricule, createdAt: serverTimestamp() });
      return matricule;
    }));
    this.audit('exit.created', created, `${input.target.name} · ${input.qty} ${input.target.unit}${input.origin ? ` · ${input.origin}` : ''} · ${exitLabel(input.reason)}${input.lot ? ` · ${input.lot}` : ''}`);
    return created;
  }

  /** Une sortie annulée remet la quantité en stock et reste dans l'historique. */
  async cancelExit(exit: StockExit) {
    const exitRef = doc(db, 'lots', exit.id);
    await this.guarded(runTransaction(db, async tx => {
      const snap = await tx.get(exitRef);
      if (snap.data()?.['cancelled']) throw new Error('Cette sortie est déjà annulée.');
      const fridge = await this.fridgeInTx(tx);
      const product = exit.target.kind === 'product' ? await this.productInTx(tx, exit.target.id) : undefined;
      this.moveLot(tx, { ...this.asLot(exit), back: exit.carcasses }, exit.qty, fridge, product);
      tx.update(exitRef, { cancelled: true });
    }));
    this.audit('exit.cancelled', exit.matricule, `${exit.target.name} · ${exit.qty} ${exit.target.unit} remis en stock`);
  }

  /**
   * Découpe des bêtes entières : leurs kilos quittent la réserve, chaque coupe reçoit son poids
   * dans son propre stock (et son pays), le reste part en os et déchets.
   */
  async addCut(cut: CutInput & { base?: Carcass[] }): Promise<string> {
    const { base, ...input } = cut;
    const year = Number(input.date.slice(0, 4));
    const counterRef = doc(db, 'settings', 'lotCounter');
    const cutRef = doc(collection(db, 'lots'));
    const waste = cutWaste(input.kg, input.cuts, input.rest);
    if (waste < -0.001) throw new StockError('Les coupes pèsent plus que les bêtes découpées : vérifiez les poids.');
    const created = await this.guarded(runTransaction(db, async tx => {
      const counter = await tx.get(counterRef);
      const fridge = await this.fridgeInTx(tx);
      const products = await Promise.all(input.cuts.map(c => this.productInTx(tx, c.id)));
      const reserve = fridge.find(f => f.id === input.reserve.id);
      if (!reserve) throw new StockError('Ce frigo n\'existe plus.');
      // Les carcasses choisies doivent encore être suspendues
      const current = reserve.carcasses ?? base ?? carcassesOf(reserve);
      const chosen = input.carcasses ?? [];
      const missing = chosen.filter(c => !current.some(x => x.id === c.id));
      if (!chosen.length || missing.length) throw new StockError('Une des bêtes choisies n\'est plus au frigo (déjà découpée ou vendue). Rechargez la page.');
      const key = `D${year}`;
      const next = (counter.data()?.[key] ?? 0) + 1;
      const matricule = cutNumber(year, next);
      tx.set(counterRef, { [key]: next }, { merge: true });
      tx.set(cutRef, { ...input, carcasses: chosen.map(cleanCarcass), waste: Math.max(0, waste), kind: 'decoupe', matricule, createdAt: serverTimestamp() });
      const [first] = chosen;
      const rest = input.rest ? [cleanCarcass({
        id: `${matricule}-reste`, kg: roundStock(input.rest), origin: input.origin ?? first.origin, lot: first.lot, n: first.n, price: first.price, date: first.date, part: true,
      })] : [];
      tx.set(doc(db, 'settings', 'fridge'), {
        list: fridge.map(f => (f.id !== reserve.id ? f : withCarcasses(f, [...current.filter(x => !chosen.some(c => c.id === x.id)), ...rest]))),
      });
      input.cuts.forEach((c, i) => this.moveCut(tx, products[i], c.kg, input.origin, true, input.date));
      return matricule;
    }));
    this.audit('cut.created', created, `${input.reserve.name} · ${input.beasts} bête(s) · ${input.kg} kg${input.origin ? ` · ${input.origin}` : ''} → ${input.cuts.map(c => `${c.name} ${c.kg} kg`).join(', ')} · os ${Math.max(0, waste)} kg`);
    return created;
  }

  /** Une partie des os d'une découpe était encore de la viande : elle revient au frigo comme reste à redécouper. */
  async keepWaste(cut: CutRecord, kg: number) {
    const cutRef = doc(db, 'lots', cut.id);
    await this.guarded(runTransaction(db, async tx => {
      const snap = await tx.get(cutRef);
      const saved = snap.data() as CutRecord | undefined;
      if (!saved || saved.cancelled) throw new StockError('Cette découpe est annulée.');
      if (kg <= 0 || kg > saved.waste + 0.001) throw new StockError(`Indiquez entre 0 et ${saved.waste} kg.`);
      const fridge = await this.fridgeInTx(tx);
      const restId = `${cut.matricule}-reste`;
      const [first] = saved.carcasses ?? [];
      tx.update(cutRef, { waste: roundStock(saved.waste - kg), rest: roundStock((saved.rest ?? 0) + kg) });
      tx.set(doc(db, 'settings', 'fridge'), {
        list: fridge.map(f => {
          if (f.id !== cut.reserve.id) return f;
          const current = carcassesOf(f);
          const had = current.find(x => x.id === restId);
          const next = had
            ? current.map(x => (x.id === restId ? { ...x, kg: roundStock(x.kg + kg) } : x))
            : [...current, cleanCarcass({ id: restId, kg: roundStock(kg), origin: saved.origin ?? first?.origin, lot: first?.lot, n: first?.n, date: first?.date, part: true })];
          return withCarcasses(f, next);
        }),
      });
    }));
    this.audit('cut.rest', cut.matricule, `${cut.reserve.name} · ${kg} kg remis au frigo comme reste à découper`);
  }

  /** Une découpe annulée rend ses bêtes à la réserve, si les coupes n'ont pas encore été vendues. */
  async cancelCut(cut: CutRecord) {
    const cutRef = doc(db, 'lots', cut.id);
    await this.guarded(runTransaction(db, async tx => {
      const snap = await tx.get(cutRef);
      if (snap.data()?.['cancelled']) throw new Error('Cette découpe est déjà annulée.');
      const fridge = await this.fridgeInTx(tx);
      const products = await Promise.all(cut.cuts.map(c => this.productInTx(tx, c.id)));
      cut.cuts.forEach((c, i) => {
        const p = products[i];
        const o = cut.origin ? p?.origins?.find(x => x.country === cut.origin) : undefined;
        const left = o?.stock ?? p?.stock ?? 0;
        if (p && c.kg > left + 0.001) throw new StockError(`Impossible d'annuler : il ne reste que ${roundStock(left)} kg de ${c.name}, une partie a déjà été vendue.`);
      });
      const back = cut.carcasses?.length
        ? cut.carcasses
        : [cleanCarcass({ id: `retour-${cut.matricule}`, kg: cut.kg, origin: cut.origin, half: cut.beasts < 1 || undefined })];
      const restId = `${cut.matricule}-reste`;
      const reserveNow = fridge.find(f => f.id === cut.reserve.id);
      if (cut.rest && reserveNow && !carcassesOf(reserveNow).some(x => x.id === restId)) {
        throw new StockError(`Impossible d'annuler ${cut.matricule} : son reste a déjà été redécoupé. Annulez d'abord la découpe suivante.`);
      }
      tx.set(doc(db, 'settings', 'fridge'), {
        list: fridge.map(f => (f.id !== cut.reserve.id ? f : withCarcasses(f, [...carcassesOf(f).filter(x => x.id !== restId), ...back]))),
      });
      cut.cuts.forEach((c, i) => this.moveCut(tx, products[i], -c.kg, cut.origin, false));
      tx.update(cutRef, { cancelled: true });
    }));
    this.audit('cut.cancelled', cut.matricule, `${cut.reserve.name} · ${cut.beasts} bête(s) rendue(s) au frigo`);
  }

  /** Ajoute (kg > 0) ou retire les kilos d'une coupe, dans son pays ; tous les pays deviennent comptés. */
  private moveCut(tx: Transaction, p: Product | undefined, kg: number, origin: string | undefined, arrival: boolean, date?: string) {
    if (!p || !kg) return;
    const origins = originsOf(p);
    let next = origins.map(o => ({ ...o, stock: Math.max(0, roundStock((o.stock ?? 0) + (o.country === origin ? kg : 0))) }));
    if (origin && !origins.some(o => o.country === origin)) next = [...next, { country: origin, price: p.price, stock: Math.max(0, kg) }];
    tx.update(doc(db, 'products', p.id), {
      stock: increment(kg), trackStock: true, ...(arrival ? { restockDate: '' } : {}), ...(arrival && date ? { lastArrival: date } : {}), ...(next.length ? { origins: next } : {}),
    });
  }

  private asLot(e: ExitInput): LotInput {
    return { target: e.target, qty: e.qty, arrivalDate: e.date, supplierName: '', supplierRef: '', note: e.note, ...(e.origin ? { origin: e.origin } : {}), ...(e.beasts ? { beasts: e.beasts } : {}) };
  }

  private async productInTx(tx: Transaction, id: string) {
    const snap = await tx.get(doc(db, 'products', id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as Product) : undefined;
  }

  /** Remise à zéro avant un vrai test : tout le stock à 0, fiches, prix et photos inchangés. */
  async resetStock() {
    const products = await this.list<Product>('products');
    const batch = writeBatch(db);
    for (const p of products) {
      const origins = p.origins?.map(o => (o.stock === undefined ? o : { ...o, stock: 0 }));
      batch.update(doc(db, 'products', p.id), { stock: 0, ...(origins ? { origins } : {}) });
    }
    const fridge = this.fridge().map(f => ({
      ...f, kg: 0, ...(f.countries ? { countries: Object.fromEntries(Object.keys(f.countries).map(c => [c, 0])) } : {}),
    }));
    batch.set(doc(db, 'settings', 'fridge'), { list: fridge });
    await this.guarded(batch.commit());
    this.audit('stock.reset', 'Stock', `${products.length} produit(s) et ${fridge.length} frigo(s) remis à 0`);
    return products.length;
  }

  /** Efface tous les arrivages et sorties ; les matricules repartent à 0001. */
  async clearRegister() {
    const snap = await getDocs(collection(db, 'lots'));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await this.guarded(batch.commit());
    }
    await this.guarded(setDoc(doc(db, 'settings', 'lotCounter'), {}));
    this.audit('register.cleared', 'Arrivages et sorties', `${snap.docs.length} ligne(s) effacée(s), matricules remis à 0001`);
    return snap.docs.length;
  }

  /** Promotion du jour pour écouler une viande qui attend */
  async promoteToday(products: Product[], percent: number, today: string) {
    const batch = writeBatch(db);
    products.forEach(p => batch.update(doc(db, 'products', p.id), { promoPercent: percent, promoUntil: today }));
    await this.guarded(batch.commit());
    this.audit('product.updated', products.map(p => p.name_fr).join(', '), `Promotion -${percent} % jusqu'au ${today} pour écouler le stock`);
  }

  /** Met un produit en rayon (visible sur le site) ou l'en retire. */
  async setOnShelf(p: Product, on: boolean) {
    await this.update('products', p.id, { available: on });
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

  /** Ajoute (sign 1) ou retire (sign -1) un arrivage, pays par pays. */
  private moveLotParts(tx: Transaction, lot: LotMove, sign: number, fridge: FridgeItem[], product?: Product) {
    let list = fridge;
    for (const part of lotParts(lot)) {
      list = this.moveLot(tx, { ...lot, origin: part.origin, beasts: part.beasts }, sign * part.qty, list, product);
    }
  }

  /** Ajoute (qty > 0) ou retire (qty < 0) la quantité d'un arrivage ; rend le frigo mis à jour. */
  private moveLot(tx: Transaction, lot: LotMove, qty: number, fridge: FridgeItem[], product?: Product): FridgeItem[] {
    const arrival = qty > 0;
    if (lot.target.kind === 'product') {
      const origins = lot.origin && product ? originsOf(product) : [];
      const known = origins.some(o => o.country === lot.origin);
      const next = known
        ? origins.map(o => (o.country === lot.origin ? { ...o, stock: Math.max(0, roundStock((o.stock ?? 0) + qty)) } : o))
        : lot.origin ? [...origins, { country: lot.origin, price: product?.price ?? 0, stock: Math.max(0, qty) }] : [];
      tx.update(doc(db, 'products', lot.target.id), { stock: increment(qty), ...(arrival ? { restockDate: '', trackStock: true } : {}), ...(lot.origin ? { origins: next } : {}) });
      return fridge;
    }
    const list = fridge.map(f => {
      if (f.id !== lot.target.id) return f;
      const { restockDate, ...rest } = f;
      const current = carcassesOf(f);
      let next: Carcass[];
      if (arrival) {
        next = [...current, ...(lot.back?.length ? lot.back : newCarcasses(lot, qty))];
      } else if (lot.matricule && current.some(c => c.lot === lot.matricule)) {
        const mine = current.filter(c => c.lot === lot.matricule && (!lot.origin || c.origin === lot.origin));
        if (mine.length < (lot.beasts ?? 0)) {
          throw new StockError(`Impossible d'annuler ${lot.matricule} : des bêtes de cet arrivage ont déjà été découpées ou vendues.`);
        }
        next = current.filter(c => !mine.includes(c));
      } else {
        const out = removeOldest(current, lot.beasts ?? 0, lot.origin);
        if (!out) throw new StockError(`Il n'y a pas assez de bêtes entières de ${f.name}${lot.origin ? ` (${lot.origin})` : ''} au frigo.`);
        next = out;
      }
      const moved = withCarcasses(arrival ? rest : f, next);
      // Le poids moyen suit les vraies bêtes
      return moved.whole ? { ...moved, kgEach: roundStock(moved.kg / moved.whole) } : moved;
    });
    tx.set(doc(db, 'settings', 'fridge'), { list });
    return list;
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
      this.moveLotParts(tx, { ...input, matricule }, 1, fridge, product);
      return matricule;
    }));
    await this.markArrival(input);
    this.audit('lot.created', created, `${input.target.name} · ${input.beasts ? `${input.beasts} bête(s) · ` : ''}${input.qty} ${input.target.unit} · ${lotParts(input).map(p => p.origin).filter(Boolean).join(', ')}${input.cost ? ` · ${formatNumber(input.cost)} DA` : ''} · ${input.supplierName} · réf. ${input.supplierRef}`);
    return created;
  }

  /** Les arrivages sont privés : seule la date passe sur la fiche des produits concernés. */
  private async markArrival(input: LotInput) {
    try {
      const products = await this.list<Product>('products');
      const fridge = this.fridge();
      const touched = products.filter(p => (input.target.kind === 'product' ? p.id === input.target.id : poolOf(p, fridge)?.id === input.target.id));
      const batch = writeBatch(db);
      touched.forEach(p => batch.update(doc(db, 'products', p.id), { lastArrival: input.arrivalDate }));
      await batch.commit();
    } catch (e) {
      console.warn('Date d\'arrivage non affichée', e);
    }
  }

  /** Un créneau annulé redevient libre pour les autres clients. */
  private async releaseSlot(o: Order, status: OrderStatus) {
    const slot = slotInLabel(o.typeLabel);
    if (status !== 'annulé' || o.status === 'annulé' || !slot || !this.settings().deliverySlotMax) return;
    try {
      await setDoc(doc(db, 'slotLoad', slotKey(o.date, slot)), { count: increment(-1) }, { merge: true });
    } catch (e) {
      console.warn('Créneau non libéré', e);
    }
  }

  /** Un arrivage annulé reste dans l'historique : son matricule n'est jamais réutilisé. */
  async cancelLot(lot: Lot) {
    const lotRef = doc(db, 'lots', lot.id);
    await this.guarded(runTransaction(db, async tx => {
      const snap = await tx.get(lotRef);
      if (snap.data()?.['cancelled']) throw new Error('Cet arrivage est déjà annulé.');
      const fridge = await this.fridgeInTx(tx);
      const product = await this.lotProduct(tx, lot);
      this.moveLotParts(tx, lot, -1, fridge, product);
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
