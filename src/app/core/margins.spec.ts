import { FridgeItem, Product } from './data';
import { Lot } from './lots';
import { cutCost, marginOf, productCosts } from './margins';
import { CutRecord } from './stock-chain';

const moutons = { id: 'moutons', name: 'Moutons', tracked: true, kg: 0, min: 0, max: 0, kgEach: 20 } as FridgeItem;
const lot = {
  id: 'l', matricule: 'LOT-2026-0001', target: { kind: 'fridge', id: 'moutons', name: 'Moutons', unit: 'kg' }, qty: 44, arrivalDate: '2026-11-08',
  supplierName: '', supplierRef: '', note: '', cost: 154000, lines: [{ kg: 22, origin: 'Algérie', price: 3500 }, { kg: 22, origin: 'Algérie', price: 3500 }],
} as Lot;
const cut = {
  id: 'c', kind: 'decoupe', matricule: 'DEC-2026-0001', reserve: { id: 'moutons', name: 'Moutons' }, beasts: 1, kg: 22, waste: 4, date: '2026-11-09', note: '',
  carcasses: [{ id: 'LOT-2026-0001-1', kg: 22, lot: 'LOT-2026-0001', n: 1 }], cuts: [{ id: 'gigot-agneau', name: 'Gigot', kg: 10 }, { id: 'epaule-agneau', name: 'Épaule', kg: 8 }],
} as CutRecord;
const product = (over: Partial<Product>) => ({ id: 'x', name_fr: 'X', unit: 'kg', price: 4500, ...over }) as Product;

describe('marges', () => {
  it('le kilo de viande découpée coûte plus cher que le kilo de carcasse, à cause des os', () => {
    // 22 kg × 3 500 DA = 77 000 DA pour 18 kg vendables
    expect(cutCost(cut, [lot])).toBe(Math.round(77000 / 18));
  });

  it('donne le coût de chaque produit : découpe, bête entière, arrivage direct', () => {
    const fish = { ...lot, id: 'f', matricule: 'LOT-2026-0002', target: { kind: 'product', id: 'merlan', name: 'Merlan', unit: 'kg' }, qty: 10, cost: 0, price: 900, lines: undefined } as Lot;
    const costs = productCosts(
      [product({ id: 'gigot-agneau' }), product({ id: 'mouton-entier' }), product({ id: 'merlan', source: 'none' }), product({ id: 'sauce', source: 'none' })],
      [moutons], [lot, fish], [cut],
    );
    expect(costs.get('gigot-agneau')).toEqual({ cost: 4278, from: 'Découpe DEC-2026-0001' });
    expect(costs.get('mouton-entier')).toEqual({ cost: 3500, from: 'Arrivage LOT-2026-0001' });
    expect(costs.get('merlan')).toEqual({ cost: 900, from: 'Arrivage LOT-2026-0002' });
    expect(costs.has('sauce')).toBe(false);
  });

  it('calcule le gain et signale une vente à perte', () => {
    expect(marginOf(product({ price: 5000 }), { cost: 4000, from: '' })).toEqual({ cost: 4000, from: '', price: 5000, gain: 1000, rate: 20 });
    expect(marginOf(product({ price: 3700 }), { cost: 4278, from: '' })!.gain).toBe(-578);
    expect(marginOf(product({ price: 0 }), { cost: 4278, from: '' })).toBeUndefined();
  });
});
