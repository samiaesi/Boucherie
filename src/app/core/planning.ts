import { Order, OrderItem, OrderStatus } from './data';

const DONE: OrderStatus[] = ['annulé', 'livré', 'récupéré'];

export interface PlanningEntry {
  order: Order;
  /** Heure de retrait, vide pour une réservation sans créneau */
  time: string;
  items: OrderItem[];
}

export interface PlanningTotal {
  name: string;
  option: string;
  qty: number;
  /** Poids total pour la vente au kg */
  grams: number;
}

export interface PlanningDay {
  date: string;
  entries: PlanningEntry[];
  totals: PlanningTotal[];
}

/** L'heure choisie par le client figure dans le libellé : « Commande spéciale 13:00 · … ». */
export const slotTime = (o: Pick<Order, 'typeLabel'>) => /\b(\d{2}:\d{2})\b/.exec(o.typeLabel)?.[1] ?? '';

/** Ce qu'il reste à préparer entre deux dates incluses : commandes spéciales et réservations. */
export function planningDays(orders: Order[], from: string, to: string): PlanningDay[] {
  const active = orders.filter(o => !DONE.includes(o.status) && o.date >= from && o.date <= to)
    .map(order => ({ order, time: slotTime(order), items: (order.items ?? []).filter(i => i.special) }))
    .filter(e => e.items.length > 0);

  return [...new Set(active.map(e => e.order.date))].sort().map(date => {
    const entries = active.filter(e => e.order.date === date)
      .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
    const totals = new Map<string, PlanningTotal>();
    for (const item of entries.flatMap(e => e.items)) {
      const name = item.name_fr ?? item.productId, option = item.option_fr ?? '';
      const key = `${name}|${option}`;
      const total = totals.get(key) ?? { name, option, qty: 0, grams: 0 };
      total.qty += item.qty;
      total.grams += (item.grams ?? 0) * item.qty;
      totals.set(key, total);
    }
    return { date, entries, totals: [...totals.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr')) };
  });
}
