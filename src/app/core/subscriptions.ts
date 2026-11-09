import { Lang, OrderItem, Product, itemQty, lowestPrice, originsOf } from './data';

/** Panier de la semaine : la même commande, chaque semaine le même jour */
export interface Subscription {
  id: string;
  name: string;
  tel: string;
  /** 'retrait' ou 'livraison' */
  type: string;
  address?: string;
  zone?: string;
  /** Jour de la semaine : 0 = dimanche … 6 = samedi */
  day: number;
  items: OrderItem[];
  lang: Lang;
  active: boolean;
  /** Date (AAAA-MM-JJ) de la dernière commande créée pour ce panier */
  lastOrder?: string;
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Prochaine date du jour choisi, aujourd'hui compris */
export function nextDate(day: number, today: string) {
  const current = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addDays(today, (day - current + 7) % 7);
}

/** Paniers à préparer : leur prochain jour arrive dans `within` jours et la commande n'est pas encore créée */
export function duePanels(subs: Subscription[], today: string, within = 2) {
  const limit = addDays(today, within);
  return subs
    .filter(s => s.active)
    .map(s => ({ sub: s, date: nextDate(s.day, today) }))
    .filter(x => x.date <= limit && (x.sub.lastOrder ?? '') < x.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Articles du panier aux prix du jour ; un produit retiré ou épuisé est laissé de côté,
 * l'équipe le voit et prévient le client.
 */
export function refreshItems(items: OrderItem[], products: Product[]) {
  const kept: OrderItem[] = [];
  const missing: string[] = [];
  for (const i of items) {
    const p = products.find(x => x.id === i.productId);
    if (!p || !p.available || p.unit === 'order') { missing.push(i.name_fr ?? i.productId); continue; }
    const price = originsOf(p).find(o => o.country === i.origin)?.price || lowestPrice(p) || p.price || 0;
    const total = Math.round(i.unit === 'kg' ? itemQty(i) * price : i.qty * price);
    kept.push({ ...i, price, total });
  }
  return { items: kept, missing, total: kept.reduce((sum, i) => sum + (i.total ?? 0), 0) };
}
