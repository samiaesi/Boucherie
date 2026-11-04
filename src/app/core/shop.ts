import { Injectable, computed, signal } from '@angular/core';
import { collection, doc, getDoc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Announcement, liveAnnouncements } from './announcements';
import { db } from './firebase';
import { TKey } from './i18n';
import { localDay } from './stats';
import {
  Category, DEFAULT_CATEGORIES, DEFAULT_OFFERS, DEFAULT_PRODUCTS, DEFAULT_SETTINGS, FridgeItem,
  Offer, Order, Product, Settings, applyPools, byOrder, orderRef, readFridge,
} from './data';

const ORDER_TIMEOUT_MS = 15000;

function savedLastOrder() {
  try {
    return localStorage.getItem('lastOrder') ?? '';
  } catch {
    return '';
  }
}

/** Lecture publique du contenu du site et envoi des commandes. */
@Injectable({ providedIn: 'root' })
export class Shop {
  readonly categories = signal<Category[]>(DEFAULT_CATEGORIES);
  private readonly catalog = signal<Product[]>(DEFAULT_PRODUCTS);
  private readonly fridge = signal<FridgeItem[]>([]);
  /** Catalogue avec le stock des réserves du frigo */
  readonly products = computed(() => applyPools(this.catalog(), this.fridge()));
  readonly offers = signal<Offer[]>(DEFAULT_OFFERS);
  readonly settings = signal<Settings>(DEFAULT_SETTINGS);
  /** Le message d'accroche suit le paramétrage de la livraison */
  readonly pickupKey = computed<TKey>(() => (this.settings().deliveryEnabled ? 'pickupBoth' : 'pickup'));

  /** Dernière commande de ce navigateur, pour le lien de suivi */
  readonly lastOrder = signal(savedLastOrder());

  private readonly announcements = signal<Announcement[]>([]);
  /** Annonces en ligne aujourd'hui */
  readonly live = computed(() => liveAnnouncements(this.announcements(), localDay(new Date())));

  async load() {
    this.loadAnnouncements();
    try {
      const [ps, os, ss, cs, fs] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'offers')),
        getDoc(doc(db, 'settings', 'main')),
        getDoc(doc(db, 'settings', 'categories')),
        getDoc(doc(db, 'settings', 'fridge')),
      ]);
      const visible = <T extends { available?: boolean; order?: number }>(list: T[]) =>
        list.filter(x => x.available !== false).sort(byOrder);
      // Tant que l'admin n'a rien saisi, on garde les données par défaut
      if (!ps.empty) this.catalog.set(visible(ps.docs.map(d => ({ ...d.data(), id: d.id }) as Product)));
      if (!os.empty) this.offers.set(visible(os.docs.map(d => ({ ...d.data(), id: d.id }) as Offer)));
      if (ss.exists()) this.settings.set({ ...DEFAULT_SETTINGS, ...(ss.data() as Partial<Settings>) });
      if (fs.exists()) this.fridge.set(readFridge(fs.data()['list']));
      if (cs.exists()) this.categories.set([...(cs.data()['list'] as Category[])].sort(byOrder));
    } catch (e) {
      console.warn('Firebase indisponible, affichage des données par défaut', e);
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

  category(id: string) {
    return this.categories().find(c => c.id === id);
  }

  /** Enregistre la commande et sa fiche de suivi, puis renvoie son identifiant. Rejette si Firestore ne répond pas. */
  async createOrder(order: Omit<Order, 'id' | 'status' | 'createdAt'>): Promise<string> {
    const ref = doc(collection(db, 'orders'));
    const batch = writeBatch(db);
    batch.set(ref, { ...order, status: 'nouveau', createdAt: serverTimestamp() });
    batch.set(doc(db, 'tracking', ref.id), {
      status: 'nouveau', delivery: order.type === 'livraison', date: order.date, ref: orderRef(ref.id),
      steps: { nouveau: serverTimestamp() },
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ORDER_TIMEOUT_MS));
    await Promise.race([batch.commit(), timeout]);
    this.lastOrder.set(ref.id);
    try { localStorage.setItem('lastOrder', ref.id); } catch {}
    return ref.id;
  }
}
