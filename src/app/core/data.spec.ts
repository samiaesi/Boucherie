import { DEFAULT_PRODUCTS, FridgeItem, Product, animals, applyPools, itemQty, poolOf, readFridge } from './data';

const sheep: FridgeItem = { id: 'moutons', name: 'Moutons', tracked: true, kg: 66, min: 100, max: 300, kgEach: 20 };
const find = (id: string) => DEFAULT_PRODUCTS.find(p => p.id === id)!;

describe('Réserve du frigo', () => {
  it('relie le mouton entier, le demi-mouton et les coupes à la même réserve', () => {
    for (const id of ['mouton-entier', 'demi-mouton', 'gigot-agneau', 'cotelettes-agneau']) {
      expect(poolOf(find(id), [sheep])?.id).toBe('moutons');
    }
  });

  it('partage les kg de la réserve entre toutes les coupes', () => {
    const [half, gigot] = applyPools([find('demi-mouton'), find('gigot-agneau')], [sheep]);
    expect([half.stock, gigot.stock]).toEqual([66, 66]);
    expect([half.trackStock, half.stockAlert, half.stockMax]).toEqual([true, 100, 300]);
  });

  it('épuise toutes les coupes quand la réserve est vide, avec la date de retour', () => {
    const [gigot] = applyPools([find('gigot-agneau')], [{ ...sheep, kg: 0, restockDate: '2099-11-06' }]);
    expect([gigot.stock, gigot.restockDate]).toEqual([0, '2099-11-06']);
  });

  it('ne change rien tant que la réserve n\'est pas suivie', () => {
    const gigot = find('gigot-agneau');
    expect(applyPools([gigot], [{ ...sheep, tracked: false, kg: 0 }])[0]).toBe(gigot);
  });

  it('laisse un produit garder son stock propre', () => {
    const own: Product = { ...find('gigot-agneau'), source: 'none' };
    expect(poolOf(own, [sheep])).toBeUndefined();
  });

  it('n\'associe pas les produits sans réserve', () => {
    expect(poolOf(find('merguez'), [sheep])).toBeUndefined();
  });

  it('compte un demi-mouton de 10 kg comme 10 kg retirés', () => {
    expect(itemQty({ productId: 'demi-mouton', unit: 'kg', grams: 10000, qty: 1 })).toBe(10);
    expect(animals(sheep, 10)).toBe(0.5);
  });

  it('convertit l\'ancien frigo compté en bêtes', () => {
    const [f] = readFridge([{ id: 'moutons', name: 'Moutons', count: 3, min: 0, max: 0, kgEach: 20 } as never]);
    expect([f.kg, f.tracked]).toEqual([60, false]);
  });
});
