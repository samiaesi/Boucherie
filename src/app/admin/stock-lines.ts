import { FridgeItem, Product, applyPools, isLowStock, isOutOfStock, isOverStock, poolOf, reorderQty, roundStock, stockUnit } from '../core/data';

export type StockState = 'out' | 'low' | 'over' | 'ok' | 'untracked';

export const STATE_LABELS: Record<StockState, string> = {
  out: 'Rupture', low: 'Stock bas', over: 'Trop de stock', ok: 'En stock', untracked: 'Non suivi',
};

export interface StockLine {
  product: Product;
  state: StockState;
  qty: number;
  min: number;
  max: number;
  unit: string;
  /** Réserve du frigo qui porte le stock de ce produit */
  pool?: FridgeItem;
  /** Quantité à racheter pour revenir au maximum */
  reorder: number;
  /** Remplissage de la jauge en %, null sans minimum ni maximum */
  fill: number | null;
}

const RANK: Record<StockState, number> = { out: 0, low: 1, over: 2, ok: 3, untracked: 4 };

function stateOf(p: Product): StockState {
  if (!p.trackStock) return 'untracked';
  return isOutOfStock(p) ? 'out' : isLowStock(p) ? 'low' : isOverStock(p) ? 'over' : 'ok';
}

function fillOf(qty: number, min: number, max: number) {
  const top = max || min * 2;
  return top ? Math.min(100, Math.round((Math.max(0, qty) / top) * 100)) : null;
}

/** Une ligne par produit, les problèmes en premier. */
export function stockLines(products: Product[], fridge: FridgeItem[]): StockLine[] {
  const lines = applyPools(products, fridge).map((p): StockLine => {
    const qty = roundStock(p.stock ?? 0), min = p.stockAlert ?? 0, max = p.stockMax ?? 0, state = stateOf(p);
    return {
      product: p, state, qty, min, max, unit: p.unit === 'kg' ? 'kg' : stockUnit(p), pool: poolOf(p, fridge),
      reorder: state === 'out' || state === 'low' ? reorderQty(p) : 0, fill: state === 'untracked' ? null : fillOf(qty, min, max),
    };
  });
  return lines.sort((a, b) => RANK[a.state] - RANK[b.state]);
}

/** Nombre de produits par état, pour le résumé en haut de page. */
export function stockCounts(lines: StockLine[]) {
  const counts: Record<StockState, number> = { out: 0, low: 0, over: 0, ok: 0, untracked: 0 };
  for (const l of lines) counts[l.state]++;
  return counts;
}
