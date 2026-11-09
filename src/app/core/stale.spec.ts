import { FridgeItem, Product } from './data';
import { daysBetween, staleItems } from './stale';

const moutons = {
  id: 'moutons', name: 'Moutons', tracked: true, kg: 48, min: 0, max: 0, kgEach: 24, whole: 2,
  carcasses: [{ id: 'a', kg: 22, lot: 'LOT-2026-0001', n: 2, date: '2026-11-03' }, { id: 'b', kg: 26, lot: 'LOT-2026-0002', n: 1, date: '2026-11-08' }],
} as FridgeItem;
const product = (over: Partial<Product>) => ({ id: 'x', name_fr: 'X', unit: 'kg', available: true, price: 1, ...over }) as Product;

describe('à écouler', () => {
  it('compte les jours entre deux dates', () => {
    expect(daysBetween('2026-11-03', '2026-11-09')).toBe(6);
  });

  it('signale les vieilles carcasses et les produits qui ne partent pas, les plus anciens d\'abord', () => {
    const items = staleItems([
      product({ id: 'mouton-entier', source: 'moutons' }),
      product({ id: 'gigot-agneau', source: 'moutons', trackStock: true, stock: 6, lastArrival: '2026-11-04' }),
      product({ id: 'merlan', source: 'none', trackStock: true, stock: 0, lastArrival: '2026-10-01' }),
      product({ id: 'kefta', source: 'none', trackStock: true, stock: 3, lastArrival: '2026-11-08' }),
    ], [moutons], '2026-11-09');
    expect(items.map(i => [i.key, i.age])).toEqual([['carcass-a', 6], ['product-gigot-agneau', 5]]);
    expect(items[0].products.map(p => p.id)).toEqual(['mouton-entier']);
  });
});
