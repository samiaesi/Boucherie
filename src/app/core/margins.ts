import { FridgeItem, Product, carcassOf, lowestPrice, reserveOf, roundStock } from './data';
import { Lot } from './lots';
import { CutRecord } from './stock-chain';

/** Prix de revient d'un produit, en DA par kg (ou par pièce), et d'où il vient */
export interface Cost {
  cost: number;
  /** Explication courte : « Découpe DEC-2026-0001 », « Arrivage LOT-2026-0003 »… */
  from: string;
}

export interface Margin extends Cost {
  price: number;
  /** Gain par kg (ou par pièce) ; négatif si on vend à perte */
  gain: number;
  /** Gain en % du prix de vente */
  rate: number;
}

const byNewest = <T extends { date?: string; arrivalDate?: string }>(list: T[]) =>
  [...list].sort((a, b) => (b.date ?? b.arrivalDate ?? '').localeCompare(a.date ?? a.arrivalDate ?? ''));

/** Prix d'achat au kg d'une bête, retrouvé dans son arrivage */
function linePrice(lots: Lot[], lot?: string, n?: number) {
  if (!lot || !n) return 0;
  return lots.find(l => l.matricule === lot)?.lines?.[n - 1]?.price ?? 0;
}

/** Prix d'achat moyen au kg du dernier arrivage chiffré d'une réserve ou d'un produit */
function lastLotPrice(lots: Lot[], kind: 'fridge' | 'product', id: string): Cost | undefined {
  for (const l of byNewest(lots.filter(x => !x.cancelled && x.target.kind === kind && x.target.id === id))) {
    if (l.cost && l.qty) return { cost: Math.round(l.cost / l.qty), from: `Arrivage ${l.matricule}` };
    if (l.price) return { cost: l.price, from: `Arrivage ${l.matricule}` };
  }
  return undefined;
}

/**
 * Coût réel d'une découpe au kg de viande vendable : le prix des bêtes découpées divisé par
 * le poids qui reste une fois les os retirés. Les os font donc monter le prix du kilo.
 */
export function cutCost(cut: CutRecord, lots: Lot[], fallback = 0) {
  const carcasses = cut.carcasses ?? [];
  const bought = carcasses.length
    ? carcasses.reduce((sum, c) => sum + c.kg * (c.price || linePrice(lots, c.lot, c.n) || fallback), 0)
    : cut.kg * fallback;
  const sellable = cut.kg - Math.max(0, cut.waste);
  return bought && sellable > 0 ? Math.round(bought / sellable) : 0;
}

/** Prix de revient de chaque produit, à partir des arrivages et des découpes. */
export function productCosts(products: Product[], fridge: FridgeItem[], lots: Lot[], cuts: CutRecord[]) {
  const costs = new Map<string, Cost>();
  const liveCuts = byNewest(cuts.filter(c => !c.cancelled));
  for (const p of products) {
    const reserve = reserveOf(p, fridge);
    if (reserve && carcassOf(p)) {
      const c = lastLotPrice(lots, 'fridge', reserve.id);
      if (c) costs.set(p.id, c);
      continue;
    }
    const cut = liveCuts.find(c => c.cuts.some(x => x.id === p.id));
    if (cut) {
      const fallback = lastLotPrice(lots, 'fridge', cut.reserve.id)?.cost ?? 0;
      const cost = cutCost(cut, lots, fallback);
      if (cost) { costs.set(p.id, { cost, from: `Découpe ${cut.matricule}` }); continue; }
    }
    const own = lastLotPrice(lots, 'product', p.id);
    if (own) costs.set(p.id, own);
  }
  return costs;
}

/** Marge d'un produit vendu au prix affiché (le pays le moins cher) */
export function marginOf(p: Product, cost?: Cost): Margin | undefined {
  const price = lowestPrice(p);
  if (!cost || !price) return undefined;
  const gain = price - cost.cost;
  return { ...cost, price, gain, rate: roundStock((gain / price) * 100) };
}
