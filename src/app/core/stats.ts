import { Order, Product, itemQty } from './data';

export interface DayCount { day: string; count: number; }
export interface Ranked { label: string; value: number; }

export interface OrderStats {
  received: number;
  inProgress: number;
  delivered: number;
  pickedUp: number;
  cancelled: number;
  deliveryOrders: number;
  pickupOrders: number;
  /** Chiffre d'affaires des commandes non annulées */
  revenue: number;
  average: number;
  /** Commandes sans montant (anciennes) exclues du chiffre d'affaires */
  withoutAmount: number;
  perDay: DayCount[];
  topProducts: (Ranked & { unit: string })[];
  zones: Ranked[];
}

const TOP = 6;

export const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Tous les jours de la période, y compris ceux sans commande */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  const end = new Date(`${to}T00:00`);
  for (let d = new Date(`${from}T00:00`); d <= end; d.setDate(d.getDate() + 1)) days.push(localDay(d));
  return days;
}

const ranked = (map: Map<string, number>) =>
  [...map].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

export function orderStats(all: Order[], from: string, to: string, products: Product[]): OrderStats {
  const orders = all.filter(o => o.createdAt && localDay(o.createdAt) >= from && localDay(o.createdAt) <= to);
  const count = (...statuses: string[]) => orders.filter(o => statuses.includes(o.status)).length;
  const kept = orders.filter(o => o.status !== 'annulé');
  const priced = kept.filter(o => o.total !== undefined);
  const revenue = priced.reduce((sum, o) => sum + (o.total ?? 0), 0);

  const days = new Map(daysBetween(from, to).map(d => [d, 0]));
  for (const o of orders) {
    const d = localDay(o.createdAt!);
    days.set(d, (days.get(d) ?? 0) + 1);
  }

  const sold = new Map<string, number>(), units = new Map<string, string>();
  const zones = new Map<string, number>();
  for (const o of kept) {
    for (const i of o.items ?? []) {
      const name = i.name_fr || products.find(p => p.id === i.productId)?.name_fr || i.productId;
      sold.set(name, (sold.get(name) ?? 0) + itemQty(i));
      units.set(name, i.unit === 'kg' ? 'kg' : 'pièce(s)');
    }
    if (o.type === 'livraison') {
      const zone = o.zone || 'Non précisée';
      zones.set(zone, (zones.get(zone) ?? 0) + 1);
    }
  }

  return {
    received: orders.length,
    inProgress: count('nouveau', 'confirmé', 'prêt', 'en livraison'),
    delivered: count('livré'),
    pickedUp: count('récupéré'),
    cancelled: count('annulé'),
    deliveryOrders: kept.filter(o => o.type === 'livraison').length,
    pickupOrders: kept.filter(o => o.type !== 'livraison').length,
    revenue,
    average: priced.length ? Math.round(revenue / priced.length) : 0,
    withoutAmount: kept.length - priced.length,
    perDay: [...days].map(([day, n]) => ({ day, count: n })),
    topProducts: ranked(sold).slice(0, TOP).map(r => ({ ...r, unit: units.get(r.label) ?? '' })),
    zones: ranked(zones).slice(0, TOP),
  };
}
