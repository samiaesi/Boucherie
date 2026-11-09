import { carcassesOf, carcassLabel } from './carcasses';
import { FridgeItem, Product, applyPools, carcassOf, isCabinet, reserveOf, roundStock } from './data';

/** Au-delà de ce nombre de jours, une viande est à écouler en priorité */
export const STALE_DAYS = 4;

/** Ce qui attend depuis trop longtemps : une carcasse au frigo ou le stock d'un produit */
export interface StaleItem {
  key: string;
  name: string;
  detail: string;
  /** Jours depuis l'arrivée (ou la découpe) */
  age: number;
  /** Produits à mettre en promotion pour l'écouler */
  products: Product[];
}

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/**
 * Carcasses suspendues depuis plus de `days` jours (on les vend en bête entière ou en demi),
 * et produits dont le stock date du dernier arrivage ou de la dernière découpe.
 */
export function staleItems(products: Product[], fridge: FridgeItem[], today: string, days = STALE_DAYS): StaleItem[] {
  const out: StaleItem[] = [];
  for (const f of fridge.filter(x => !isCabinet(x))) {
    const sellers = products.filter(p => p.available && reserveOf(p, [f]) && carcassOf(p));
    carcassesOf(f).forEach((c, i) => {
      if (!c.date) return;
      const age = daysBetween(c.date, today);
      if (age < days) return;
      out.push({
        key: `carcass-${c.id}`, name: `${f.name} · ${carcassLabel(c, i)}`,
        detail: `${c.kg} kg${c.origin ? ` · ${c.origin}` : ''}${c.part ? ' · reste de découpe' : c.half ? ' · demi-bête' : ''}`,
        age, products: sellers,
      });
    });
  }
  for (const p of applyPools(products, fridge)) {
    if (!p.available || !p.trackStock || !p.lastArrival || (p.stock ?? 0) <= 0 || carcassOf(p)) continue;
    const age = daysBetween(p.lastArrival, today);
    if (age < days) continue;
    out.push({
      key: `product-${p.id}`, name: p.name_fr, detail: `${roundStock(p.stock ?? 0)} ${p.unit === 'kg' ? 'kg' : 'pièce(s)'} en stock`,
      age, products: [p],
    });
  }
  return out.sort((a, b) => b.age - a.age);
}
