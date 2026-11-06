import { Order, Product } from './data';

export interface SalesRow {
  id: string;
  name: string;
  /** Pièces vendues, hors vente au kg */
  qty: number;
  /** Poids vendu, en grammes */
  grams: number;
  revenue: number;
  /** Part du chiffre d'affaires, de 0 à 100 */
  share: number;
}

export interface SalesReport {
  orders: number;
  revenue: number;
  average: number;
  rows: SalesRow[];
  /** Produits en vente qui n'ont pas été vendus sur la période */
  unsold: Product[];
}

/** Ventes entre deux instants. Les commandes annulées ne comptent pas, ni les frais de livraison. */
export function salesReport(orders: Order[], products: Product[], from: Date, to: Date): SalesReport {
  const kept = orders.filter(o => o.status !== 'annulé' && !!o.createdAt && o.createdAt >= from && o.createdAt <= to);
  const rows = new Map<string, Omit<SalesRow, 'share'>>();
  for (const item of kept.flatMap(o => o.items ?? [])) {
    const row = rows.get(item.productId) ?? { id: item.productId, name: item.name_fr ?? item.productId, qty: 0, grams: 0, revenue: 0 };
    if (item.unit === 'kg') row.grams += (item.grams ?? 0) * item.qty;
    else row.qty += item.qty;
    row.revenue += item.total ?? 0;
    rows.set(item.productId, row);
  }
  const revenue = [...rows.values()].reduce((sum, r) => sum + r.revenue, 0);
  return {
    orders: kept.length, revenue, average: kept.length ? Math.round(revenue / kept.length) : 0,
    rows: [...rows.values()]
      .map(r => ({ ...r, share: revenue ? Math.round((r.revenue / revenue) * 100) : 0 }))
      .sort((a, b) => b.revenue - a.revenue || b.qty - a.qty),
    unsold: products.filter(p => p.available && !rows.has(p.id)),
  };
}
