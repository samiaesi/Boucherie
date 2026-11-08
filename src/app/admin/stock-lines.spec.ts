import { FridgeItem, Product } from '../core/data';
import { fridgeContents, fridgeIcon, fridgeLine, stockCounts, stockLines } from './stock-lines';

const product = (over: Partial<Product>) => ({
  id: 'p', name_fr: 'Poulet', unit: 'kg', source: 'none', trackStock: true, stock: 1000, stockAlert: 200, stockMax: 0, ...over,
}) as Product;

describe('stockLines', () => {
  it('donne un état à chaque produit', () => {
    const state = (over: Partial<Product>) => stockLines([product(over)], [])[0].state;
    expect(state({})).toBe('ok');
    expect(state({ stock: 150 })).toBe('low');
    expect(state({ stock: 0 })).toBe('out');
    expect(state({ stockMax: 500 })).toBe('over');
    expect(state({ trackStock: false })).toBe('untracked');
  });

  it('place les ruptures et les stocks bas en premier', () => {
    const lines = stockLines([
      product({ id: 'a', trackStock: false }), product({ id: 'b' }), product({ id: 'c', stock: 100 }), product({ id: 'd', stock: 0 }),
    ], []);
    expect(lines.map(l => l.product.id)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('suit la réserve du frigo pour le mouton entier', () => {
    const fridge = [{ id: 'moutons', name: 'Moutons', tracked: true, kg: 40, min: 100, max: 500, kgEach: 20, whole: 2 }] as FridgeItem[];
    const line = stockLines([product({ id: 'mouton-entier', trackStock: false, stock: 0, source: 'moutons' })], fridge)[0];
    expect([line.state, line.qty, line.pool?.name, line.reorder, line.fill]).toEqual(['low', 40, 'Moutons', 460, 8]);
  });

  it('une coupe garde son propre stock, suivi dès que la réserve l\'est', () => {
    const fridge = [{ id: 'moutons', name: 'Moutons', tracked: true, kg: 40, min: 100, max: 500, kgEach: 20, whole: 2 }] as FridgeItem[];
    const line = stockLines([product({ id: 'gigot', trackStock: false, stock: 6, source: 'moutons', stockAlert: 2 })], fridge)[0];
    expect([line.state, line.qty, line.pool]).toEqual(['ok', 6, undefined]);
  });

  it('remplit la jauge selon le maximum, sinon le double du minimum', () => {
    expect(stockLines([product({ stock: 250, stockMax: 1000 })], [])[0].fill).toBe(25);
    expect(stockLines([product({ stock: 300 })], [])[0].fill).toBe(75);
    expect(stockLines([product({ stock: 300, stockAlert: 0 })], [])[0].fill).toBeNull();
  });
});

describe('stockCounts', () => {
  it('compte les produits par état', () => {
    const counts = stockCounts(stockLines([product({}), product({ stock: 0 }), product({ trackStock: false })], []));
    expect(counts).toEqual({ out: 1, low: 0, over: 0, ok: 1, untracked: 1 });
  });
});

describe('fridgeLine', () => {
  const item = (over: Partial<FridgeItem>) => ({ id: 'm', name: 'Moutons', tracked: true, kg: 50, min: 10, max: 100, kgEach: 20, ...over }) as FridgeItem;

  it('donne le même état que la page Stock', () => {
    expect(fridgeLine(item({})).state).toBe('ok');
    expect(fridgeLine(item({ kg: 10 })).state).toBe('low');
    expect(fridgeLine(item({ kg: 0 })).state).toBe('out');
    expect(fridgeLine(item({ kg: 120 })).state).toBe('over');
    expect(fridgeLine(item({ tracked: false })).state).toBe('untracked');
  });

  it('remplit la jauge et compte les bêtes', () => {
    const line = fridgeLine(item({ whole: 2 }));
    expect([line.fill, line.beasts]).toEqual([50, 2]);
  });
});

describe('Frigos', () => {
  const reserve = { id: 'moutons', name: 'Moutons', tracked: false, kg: 33, min: 0, max: 0, kgEach: 16 } as FridgeItem;
  const cabinet = { id: 'poissons-surgeles', name: 'Poissons', tracked: false, kg: 0, min: 0, max: 0, kgEach: 0, rayons: ['poissons'], icon: 'poisson' } as FridgeItem;
  const products = [
    { id: 'gigot', name_fr: 'Gigot', category: 'agneau', unit: 'kg', source: 'moutons' },
    { id: 'merlan', name_fr: 'Merlan', category: 'poissons', unit: 'kg', source: 'none', trackStock: true, stock: 12, stockAlert: 2 },
    { id: 'calamar', name_fr: 'Calamar', category: 'poissons', unit: 'kg', source: 'none', trackStock: true, stock: 0 },
    { id: 'sardine', name_fr: 'Sardine', category: 'poissons', unit: 'kg', source: 'none' },
  ] as Product[];

  it('choisit le pictogramme', () => {
    expect(fridgeIcon(reserve)).toBe('agneau');
    expect(fridgeIcon(cabinet)).toBe('poisson');
  });

  it('montre les coupes dans une réserve, même non suivie', () => {
    expect(fridgeContents(reserve, products).map(c => c.product.id)).toEqual(['gigot']);
  });

  it('montre les produits des rayons dans un frigo de surgelés', () => {
    const list = fridgeContents(cabinet, products);
    expect(list.map(c => [c.product.id, c.state, c.note])).toEqual([
      ['merlan', 'ok', '12 kg'], ['calamar', 'out', '0 kg'], ['sardine', 'untracked', 'Stock non suivi'],
    ]);
  });

  it('résume un frigo de produits par son pire état', () => {
    const line = fridgeLine(cabinet, products);
    expect([line.cabinet, line.state, line.total]).toEqual([true, 'out', 12]);
    expect(fridgeLine(cabinet, products.filter(p => p.id === 'sardine')).state).toBe('untracked');
  });
});
