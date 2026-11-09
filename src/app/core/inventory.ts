import { FridgeItem, Product, applyPools, poolOf, roundStock } from './data';

/** Une ligne à compter : un produit, ou un pays du produit quand chaque pays a son stock */
export interface CountLine {
  key: string;
  product: Product;
  origin?: string;
  name: string;
  /** Ce que l'écran croit avoir */
  expected: number;
  unit: string;
}

/** Tout ce qui a son propre stock (coupes, poissons, surgelés…), pays par pays si besoin. */
export function countLines(products: Product[], fridge: FridgeItem[]): CountLine[] {
  return applyPools(products, fridge)
    .filter(p => p.trackStock && !poolOf(p, fridge))
    .flatMap(p => {
      const unit = p.unit === 'kg' ? 'kg' : 'pièce(s)';
      const counted = (p.origins ?? []).filter(o => o.stock !== undefined);
      if (counted.length) {
        return counted.map(o => ({ key: `${p.id}|${o.country}`, product: p, origin: o.country, name: `${p.name_fr} · ${o.country}`, expected: roundStock(o.stock ?? 0), unit }));
      }
      return [{ key: p.id, product: p, name: p.name_fr, expected: roundStock(p.stock ?? 0), unit }];
    });
}

/** Écart entre ce qui est compté et l'écran : négatif s'il manque de la marchandise */
export const gapOf = (line: CountLine, counted: number | null | undefined) =>
  counted === null || counted === undefined || Number.isNaN(counted) ? null : roundStock(counted - line.expected);

/** Résumé de l'inventaire : lignes comptées, kilos manquants et en trop */
export function countSummary(lines: CountLine[], counts: Record<string, number | null>) {
  let done = 0, missing = 0, extra = 0;
  for (const l of lines) {
    const gap = gapOf(l, counts[l.key]);
    if (gap === null) continue;
    done++;
    if (gap < 0) missing = roundStock(missing - gap);
    if (gap > 0) extra = roundStock(extra + gap);
  }
  return { done, missing, extra };
}
