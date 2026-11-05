import { FridgeItem, Product, animals, applyPools, isLowStock, isOutOfStock, isOverStock, poolOf, reorderQty, roundStock, stockUnit } from '../core/data';

export type StockState = 'out' | 'low' | 'over' | 'ok' | 'untracked';

export const STATE_LABELS: Record<StockState, string> = {
  out: 'Rupture', low: 'Stock bas', over: 'Trop de stock', ok: 'En stock', untracked: 'Non suivi',
};

/** Tracés SVG des états (grille 24×24) */
export const STATE_ICONS: Record<StockState, string> = {
  out: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM6 6l12 12',
  low: 'M12 4L3 20h18zM12 10v5M12 18v.01',
  over: 'M12 20V5M6 11l6-6 6 6',
  ok: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6',
  untracked: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12h8',
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

/** État d'une réserve du frigo, avec les mêmes repères que la page Stock. */
export function fridgeLine(item: FridgeItem) {
  const state: StockState = !item.tracked ? 'untracked'
    : item.kg <= 0 ? 'out'
    : item.min && item.kg <= item.min ? 'low'
    : item.max && item.kg > item.max ? 'over' : 'ok';
  return { item, state, fill: fillOf(item.kg, item.min, item.max), beasts: animals(item, Number(item.kg) || 0) };
}

/** Nombre de produits par état, pour le résumé en haut de page. */
export function stockCounts(lines: StockLine[]) {
  const counts: Record<StockState, number> = { out: 0, low: 0, over: 0, ok: 0, untracked: 0 };
  for (const l of lines) counts[l.state]++;
  return counts;
}
