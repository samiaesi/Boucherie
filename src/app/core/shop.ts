import { slotKey } from './delivery-slots';
import { algeriaClock } from './ordering';
import { applyPromos } from './promo';
import { normalizeTel, validTel } from './loyalty';
import type { Campaign } from './campaigns';
import { DEFAULT_RECIPES, Recipe } from './recipes';
import { PromoCode, normalizeCode } from './promo-codes';
import type { Subscription } from './subscriptions';
import { rebuildBasket } from './basket';
import type { Cart } from './cart';
import type { I18n } from './i18n';
import { Injectable, computed, signal } from '@angular/core';
import { addDoc, collection, doc, getDoc, getDocs, increment, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { AboutInfo, Certificate, DEFAULT_ABOUT, hasAboutContent } from './about';
import { Announcement, liveAnnouncements } from './announcements';
import { db } from './firebase';
import { TKey } from './i18n';
import { DEFAULT_ORDERING, OrderingRules, orderingState } from './ordering';
import { localDay } from './stats';
import {
  Category, DEFAULT_CATEGORIES, DEFAULT_PRODUCTS, DEFAULT_SETTINGS, FridgeItem,
  Order, Product, Settings, applyPools, byOrder, orderRef, readFridge,
} from './data';

const ORDER_TIMEOUT_MS = 15000;
const CLOCK_TICK_MS = 30000;

const MY_TEL = 'loyaltyTel';
const CUSTOMER = 'customer';

/** Coordonnées gardées sur l'appareil du client, pour ne pas les retaper. */
export interface Customer {
  name: string;
  tel: string;
  zone: string;
  address: string;
}

function savedCustomer(): Customer {
  const empty = { name: '', tel: '', zone: '', address: '' };
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(CUSTOMER) ?? '{}') };
  } catch {
    return empty;
  }
}

function savedTel() {
  try {
    return localStorage.getItem(MY_TEL) ?? '';
  } catch {
    return '';
  }
}

function savedLastOrder() {
  try {
    return localStorage.getItem('lastOrder') ?? '';
  } catch {
    return '';
  }
}

/** Lecture publique du contenu du site et envoi des commandes. */
/** Un rayon enregistré sans photo reprend celle du catalogue par défaut. */
const withDefaultImage = (c: Category) => {
  const image = c.image || DEFAULT_CATEGORIES.find(d => d.id === c.id)?.image;
  return image ? { ...c, image } : c;
};

@Injectable({ providedIn: 'root' })
export class Shop {
  readonly categories = signal<Category[]>(DEFAULT_CATEGORIES);
  private readonly catalog = signal<Product[]>(DEFAULT_PRODUCTS);
  private readonly fridge = signal<FridgeItem[]>([]);
  /** Catalogue avec le stock des réserves du frigo */
  readonly products = computed(() => applyPromos(applyPools(this.catalog(), this.fridge()), algeriaClock(this.now()).date));
  /** Produits en promotion aujourd'hui */
  readonly promos = computed(() => this.products().filter(p => p.oldPrice !== undefined));
  readonly campaigns = signal<Campaign[]>([]);
  readonly recipes = signal<Recipe[]>(DEFAULT_RECIPES);
  private recipesLoaded = false;

  /** Panier de la semaine : la boucherie le retrouve dans l'admin chaque semaine */
  async createSubscription(sub: Omit<Subscription, 'id' | 'active' | 'lastOrder'>, firstDate: string) {
    await addDoc(collection(db, 'subscriptions'), { ...sub, active: true, lastOrder: firstDate, createdAt: serverTimestamp() });
  }

  /** Code promo du client : un nom de code, ou le numéro d'un parrain (carte de fidélité) */
  async findCode(text: string): Promise<{ kind: 'promo'; code: PromoCode } | { kind: 'referral'; tel: string } | null> {
    const digits = text.replace(/\D/g, '');
    if (validTel(digits)) {
      const tel = normalizeTel(digits);
      const card = await getDoc(doc(db, 'loyalty', tel));
      return card.exists() ? { kind: 'referral', tel } : null;
    }
    const id = normalizeCode(text);
    if (!id) return null;
    const snap = await getDoc(doc(db, 'promoCodes', id));
    return snap.exists() ? { kind: 'promo', code: { ...(snap.data() as PromoCode), id } } : null;
  }

  /** Recettes enregistrées dans l'admin, sinon celles de départ */
  async loadRecipes() {
    if (this.recipesLoaded) return;
    this.recipesLoaded = true;
    try {
      const snap = await getDoc(doc(db, 'settings', 'recipes'));
      if (snap.exists()) this.recipes.set(snap.data()['list'] as Recipe[]);
    } catch {
      this.recipesLoaded = false;
    }
  }
  readonly settings = signal<Settings>(DEFAULT_SETTINGS);
  /** Le message d'accroche suit le paramétrage de la livraison */
  readonly pickupKey = computed<TKey>(() => (this.settings().deliveryEnabled ? 'pickupBoth' : 'pickup'));

  /** Dernière commande de ce navigateur, pour le lien de suivi */
  readonly lastOrder = signal(savedLastOrder());
  /** Numéro du client sur cet appareil, pour retrouver ses points sans le retaper */
  readonly myTel = signal(savedTel());
  customer = savedCustomer();

  private readonly announcements = signal<Announcement[]>([]);
  /** Annonces en ligne aujourd'hui */
  readonly live = computed(() => liveAnnouncements(this.announcements(), localDay(new Date())));

  readonly about = signal<AboutInfo>(DEFAULT_ABOUT);
  /** Le lien du menu n'apparaît que si la page a du contenu */
  readonly hasAbout = computed(() => hasAboutContent(this.about()));
  readonly orderingRules = signal<OrderingRules>(DEFAULT_ORDERING);
  /** Écart avec l'heure du serveur : l'horloge d'un téléphone peut être fausse */
  private clockOffset = 0;
  private readonly now = signal(new Date());
  /** Commandes ouvertes ou non, à jour sur les pages déjà ouvertes */
  readonly ordering = computed(() => orderingState(this.orderingRules(), this.now()));
  private watching = false;

  /** Heure corrigée avec celle du serveur */
  clock() {
    return new Date(Date.now() + this.clockOffset);
  }

  refreshClock() {
    this.now.set(new Date(Date.now() + this.clockOffset));
  }

  private async syncClock() {
    try {
      const res = await fetch('/', { method: 'HEAD', cache: 'no-store' });
      const server = Date.parse(res.headers.get('date') ?? '');
      if (!isNaN(server)) this.clockOffset = server - Date.now();
    } catch (e) {
      console.warn('Heure du serveur indisponible', e);
    }
    this.refreshClock();
  }

  private watchOrdering() {
    if (this.watching) return;
    this.watching = true;
    this.syncClock();
    setInterval(() => this.refreshClock(), CLOCK_TICK_MS);
    onSnapshot(
      doc(db, 'settings', 'ordering'),
      snap => this.orderingRules.set({ ...DEFAULT_ORDERING, ...(snap.data() as Partial<OrderingRules> | undefined) }),
      e => console.warn('Horaires indisponibles', e),
    );
  }

  /** Les images ne sont lues que sur la page Notre boucherie. */
  async loadAboutMedia() {
    try {
      const [gallery, certificates] = await Promise.all(['gallery', 'certificates'].map(id => getDoc(doc(db, 'settings', id))));
      return { photos: (gallery.data()?.['list'] ?? []) as string[], certificates: (certificates.data()?.['list'] ?? []) as Certificate[] };
    } catch (e) {
      console.warn('Page Notre boucherie indisponible', e);
      return { photos: [], certificates: [] };
    }
  }

  private async loadAbout() {
    try {
      const snap = await getDoc(doc(db, 'settings', 'about'));
      if (snap.exists()) this.about.set({ ...DEFAULT_ABOUT, ...(snap.data() as Partial<AboutInfo>) });
    } catch (e) {
      console.warn('Page Notre boucherie indisponible', e);
    }
  }

  async load() {
    this.watchOrdering();
    this.loadAbout();
    this.loadAnnouncements();
    this.loadCampaigns();
    try {
      const [ps, ss, cs, fs] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDoc(doc(db, 'settings', 'main')),
        getDoc(doc(db, 'settings', 'categories')),
        getDoc(doc(db, 'settings', 'fridge')),
      ]);
      const visible = <T extends { available?: boolean; order?: number }>(list: T[]) =>
        list.filter(x => x.available !== false).sort(byOrder);
      // Tant que l'admin n'a rien saisi, on garde les données par défaut
      if (!ps.empty) this.catalog.set(visible(ps.docs.map(d => ({ ...d.data(), id: d.id }) as Product)));
      if (ss.exists()) this.settings.set({ ...DEFAULT_SETTINGS, ...(ss.data() as Partial<Settings>) });
      if (fs.exists()) this.fridge.set(readFridge(fs.data()['list']));
      if (cs.exists()) this.categories.set((cs.data()['list'] as Category[]).map(withDefaultImage).sort(byOrder));
    } catch (e) {
      console.warn('Firebase indisponible, affichage des données par défaut', e);
    }
  }

  private async loadCampaigns() {
    try {
      const snap = await getDoc(doc(db, 'settings', 'reservations'));
      if (snap.exists()) this.campaigns.set(snap.data()['list'] as Campaign[]);
    } catch (e) {
      console.warn('Réservations indisponibles', e);
    }
  }

  /** À part : une erreur sur les annonces ne doit pas empêcher le catalogue de s'afficher. */
  private async loadAnnouncements() {
    try {
      const snap = await getDocs(collection(db, 'announcements'));
      this.announcements.set(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Announcement));
    } catch (e) {
      console.warn('Annonces indisponibles', e);
    }
  }

  /** Une adresse vide ne remplace pas celle déjà connue : un retrait n'efface pas la livraison. */
  rememberCustomer(c: Partial<Customer>) {
    const known = Object.fromEntries(Object.entries(c).filter(([, v]) => !!v?.trim()));
    this.customer = { ...this.customer, ...known };
    try { localStorage.setItem(CUSTOMER, JSON.stringify(this.customer)); } catch {}
  }

  rememberTel(tel: string) {
    const clean = normalizeTel(tel);
    this.myTel.set(clean);
    try { localStorage.setItem(MY_TEL, clean); } catch {}
  }

  /** Remet la dernière commande dans le panier, aux prix du jour. */
  reorder(cart: Cart, i18n: I18n) {
    const { lines, missing } = rebuildBasket(cart.lastBasket(), this.products());
    if (lines.length) {
      cart.refill(lines);
      cart.open.set(true);
    }
    if (missing) cart.warn(lines.length ? i18n.t('reorderMissing').replace('{n}', String(missing)) : i18n.t('reorderNone'));
  }

  category(id: string) {
    return this.categories().find(c => c.id === id);
  }

  /** Enregistre la commande et sa fiche de suivi, puis renvoie son identifiant. Rejette si Firestore ne répond pas. */
  /** Occupation des créneaux d'un jour, quand un maximum est réglé */
  async slotCounts(date: string, slots: string[]) {
    const counts: Record<string, number> = {};
    await Promise.all(slots.map(async slot => {
      const snap = await getDoc(doc(db, 'slotLoad', slotKey(date, slot)));
      counts[slot] = (snap.data()?.['count'] as number) ?? 0;
    }));
    return counts;
  }

  async createOrder(order: Omit<Order, 'id' | 'status' | 'createdAt'>, deliverySlot = ''): Promise<string> {
    const ref = doc(collection(db, 'orders'));
    const batch = writeBatch(db);
    batch.set(ref, { ...order, status: 'nouveau', createdAt: serverTimestamp() });
    if (order.promoCode) batch.update(doc(db, 'promoCodes', order.promoCode), { uses: increment(1) });
    batch.set(doc(db, 'tracking', ref.id), {
      status: 'nouveau', delivery: order.type === 'livraison', date: order.date, ref: orderRef(ref.id),
      steps: { nouveau: serverTimestamp() },
    });
    // Compté seulement avec un maximum : sans limite, rien n'est écrit
    if (deliverySlot && this.settings().deliverySlotMax > 0) {
      batch.set(doc(db, 'slotLoad', slotKey(order.date, deliverySlot)), { count: increment(1) }, { merge: true });
    }
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ORDER_TIMEOUT_MS));
    await Promise.race([batch.commit(), timeout]);
    this.lastOrder.set(ref.id);
    if (validTel(order.tel)) this.rememberTel(order.tel);
    try { localStorage.setItem('lastOrder', ref.id); } catch {}
    return ref.id;
  }
}
