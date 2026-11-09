import { FridgeItem, Product } from './data';
import { countLines, countSummary, gapOf } from './inventory';

const moutons = { id: 'moutons', name: 'Moutons', tracked: true, kg: 44, min: 0, max: 0, kgEach: 22, whole: 2 } as FridgeItem;
const product = (over: Partial<Product>) => ({ id: 'x', name_fr: 'X', unit: 'kg', price: 1, available: true, ...over }) as Product;

describe('inventaire', () => {
  const lines = countLines([
    product({ id: 'gigot-agneau', name_fr: 'Gigot', source: 'moutons', stock: 6, origins: [{ country: 'Algérie', price: 1, stock: 6 }, { country: 'Espagne', price: 1, stock: 0 }] }),
    product({ id: 'mouton-entier', source: 'moutons' }),
    product({ id: 'merlan', name_fr: 'Merlan', source: 'none', trackStock: true, stock: 3.5 }),
    product({ id: 'sauce', source: 'none', trackStock: false }),
  ], [moutons]);

  it('liste ce qui a son propre stock, pays par pays, sans les bêtes entières', () => {
    expect(lines.map(l => [l.key, l.expected])).toEqual([['gigot-agneau|Algérie', 6], ['gigot-agneau|Espagne', 0], ['merlan', 3.5]]);
  });

  it('calcule les écarts et le résumé', () => {
    expect(gapOf(lines[0], 5.2)).toBe(-0.8);
    expect(gapOf(lines[0], null)).toBeNull();
    expect(countSummary(lines, { 'gigot-agneau|Algérie': 5.2, merlan: 4 })).toEqual({ done: 2, missing: 0.8, extra: 0.5 });
  });
});
