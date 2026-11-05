import { FridgeItem, Product } from '../core/data';
import { fridgeLine, stockCounts, stockLines } from './stock-lines';

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

  it('suit la réserve du frigo pour une coupe reliée', () => {
    const fridge = [{ id: 'moutons', name: 'Moutons', tracked: true, kg: 40, min: 100, max: 500, kgEach: 20 }] as FridgeItem[];
    const line = stockLines([product({ trackStock: false, stock: 0, source: 'moutons' })], fridge)[0];
    expect([line.state, line.qty, line.pool?.name, line.reorder, line.fill]).toEqual(['low', 40, 'Moutons', 460, 8]);
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
    const line = fridgeLine(item({}));
    expect([line.fill, line.beasts]).toEqual([50, 2.5]);
  });
});
