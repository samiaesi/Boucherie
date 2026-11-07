import { Product, isOutOfStock, noOriginLeft } from './data';

/** Réservation à l'avance : Aïd, Ramadan… Les dates sont choisies par la boucherie. */
export interface Campaign {
  id: string;
  name_fr: string;
  name_ar: string;
  text_fr: string;
  text_ar: string;
  active: boolean;
  /** Premier jour d'affichage sur le site (AAAA-MM-JJ) : par exemple 2 mois avant l'Aïd */
  opens?: string;
  /** Dernier jour pour réserver (AAAA-MM-JJ) */
  closes: string;
  /** Premier et dernier jour de retrait */
  pickupFrom: string;
  pickupTo: string;
  /** Acompte payé à la boutique, en DA par article (0 = aucun) */
  deposit: number;
  products: string[];
}

export const blankCampaign = (): Campaign => ({
  id: '', name_fr: '', name_ar: '', text_fr: '', text_ar: '', active: true, closes: '', pickupFrom: '', pickupTo: '', deposit: 0, products: [],
});

/** Réservations ouvertes aujourd'hui, la plus proche de sa fin d'abord. */
export const openCampaigns = (list: Campaign[], today: string) => list
  .filter(c => c.active && c.products.length > 0 && !!c.closes && today <= c.closes && (!c.opens || today >= c.opens))
  .sort((a, b) => a.closes.localeCompare(b.closes));

/** Produits réservables : la personnalisation et les produits épuisés restent à part. */
export const campaignProducts = (c: Campaign, products: Product[]) => c.products
  .map(id => products.find(p => p.id === id))
  .filter((p): p is Product => !!p && p.available && !p.custom && !isOutOfStock(p) && !noOriginLeft(p));

export const validPickup = (c: Campaign, date: string) => !!date && date >= c.pickupFrom && date <= c.pickupTo;
