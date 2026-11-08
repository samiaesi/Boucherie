import { FridgeItem, Order, Product } from './data';
import { Lot } from './lots';
import { StockExit, availableQty, chainSummary, exitNumber, searchExits, shelfAlerts, shelfLines, splitRegister, targetCountries } from './stock-chain';

const product = (over: Partial<Product>) => ({
  id: 'p', name_fr: 'Poulet', category: 'volaille', unit: 'kg', source: 'none', available: true, trackStock: true, stock: 10, stockAlert: 2, stockMax: 0, order: 1, ...over,
}) as Product;

const moutons = { id: 'moutons', name: 'Moutons', tracked: true, kg: 40, min: 50, max: 300, kgEach: 20, countries: { Algérie: 30, Espagne: 10 } } as FridgeItem;

const lot = (over: Partial<Lot>) => ({
  id: 'l', matricule: 'LOT-2026-0001', target: { kind: 'fridge', id: 'moutons', name: 'Moutons', unit: 'kg' }, qty: 100, arrivalDate: '2026-11-07', supplierName: 'Ferme', supplierRef: 'BL1', note: '', ...over,
}) as Lot;

const exit = (over: Partial<StockExit>) => ({
  id: 'e', kind: 'sortie', matricule: 'SOR-2026-0001', target: { kind: 'fridge', id: 'moutons', name: 'Moutons', unit: 'kg' }, qty: 3, date: '2026-11-08', reason: 'decoupe', note: '', ...over,
}) as StockExit;

describe('registre du stock', () => {
  it('numérote les sorties à part des arrivages', () => {
    expect(exitNumber(2026, 7)).toBe('SOR-2026-0007');
  });

  it('sépare arrivages et sorties', () => {
    const { lots, exits } = splitRegister([lot({}), exit({})]);
    expect([lots.length, exits.length]).toEqual([1, 1]);
  });

  it('cherche une sortie par motif ou matricule', () => {
    expect(searchExits([exit({}), exit({ id: 'f', reason: 'don', matricule: 'SOR-2026-0002' })], 'os')).toHaveLength(1);
    expect(searchExits([exit({})], 'sor-2026')).toHaveLength(1);
  });
});

describe('quantité disponible', () => {
  it('lit la réserve, le pays ou le produit', () => {
    const target = { kind: 'fridge' as const, id: 'moutons', name: 'Moutons', unit: 'kg' };
    expect(availableQty(target, [moutons], [])).toBe(40);
    expect(availableQty(target, [moutons], [], 'Espagne')).toBe(10);
    const p = product({ origins: [{ country: 'France', price: 1, stock: 4 }] });
    expect(availableQty({ kind: 'product', id: 'p', name: 'Poulet', unit: 'kg' }, [], [p])).toBe(10);
    expect(availableQty({ kind: 'product', id: 'p', name: 'Poulet', unit: 'kg' }, [], [p], 'France')).toBe(4);
  });

  it('propose seulement les pays qui ont un stock séparé', () => {
    expect(targetCountries({ kind: 'fridge', id: 'moutons', name: '', unit: 'kg' }, [moutons], [])).toEqual(['Algérie', 'Espagne']);
    expect(targetCountries(null, [moutons], [])).toEqual([]);
  });
});

describe('rayons', () => {
  it('classe les produits : vides, à remplir, en rayon, retirés', () => {
    const lines = shelfLines([
      product({ id: 'a', available: false }), product({ id: 'b' }), product({ id: 'c', stock: 1 }), product({ id: 'd', stock: 0 }), product({ id: 'e', trackStock: false }),
    ], []);
    expect(lines.map(l => [l.product.id, l.state])).toEqual([['d', 'vide'], ['c', 'remplir'], ['b', 'vitrine'], ['e', 'vitrine'], ['a', 'retire']]);
    expect(lines.find(l => l.product.id === 'e')?.qty).toBeNull();
  });

  it('une coupe reliée prend le stock de sa réserve', () => {
    const [line] = shelfLines([product({ source: 'moutons', trackStock: false })], [moutons]);
    expect([line.state, line.qty]).toEqual(['remplir', 40]);
  });

  it('compte les alertes par rayon', () => {
    const cats = [{ id: 'volaille', order: 1, icon: 'poulet', name_fr: 'Volaille', name_ar: '' }, { id: 'vide', order: 2, icon: '', name_fr: 'Vide', name_ar: '' }];
    expect(shelfAlerts([product({ stock: 0 }), product({ id: 'b' })], [], cats).map(t => [t.total, t.alerts])).toEqual([[2, 1], [0, 0]]);
  });
});

describe('chainSummary', () => {
  it('additionne chaque étape sur la période', () => {
    const order = {
      id: 'o', status: 'confirmé', stockDone: true, date: '2026-11-08',
      items: [{ unit: 'kg', grams: 1500, qty: 2 }, { unit: 'piece', qty: 3 }],
    } as unknown as Order;
    const s = chainSummary({
      lots: [lot({}), lot({ id: 'old', arrivalDate: '2026-10-01' }), lot({ id: 'x', cancelled: true })],
      exits: [exit({}), exit({ id: 'y', reason: 'perte', qty: 1.5 }), exit({ id: 'z', cancelled: true })],
      fridge: [moutons], products: [product({ stock: 0 })], orders: [order, { ...order, id: 'n', stockDone: false }],
      today: '2026-11-08', days: 7,
    });
    expect(s.from).toBe('2026-11-02');
    expect([s.arrivals.count, s.arrivals.kg]).toEqual([1, 100]);
    expect([s.fridge.kg, s.fridge.alerts]).toEqual([40, 1]);
    expect(s.shelves.toFill).toBe(1);
    expect(s.sold).toEqual({ kg: 3, pieces: 3 });
    expect([s.exits.count, s.exits.kg]).toEqual([2, 4.5]);
    expect(s.exits.byReason.map(r => r.reason)).toEqual(['decoupe', 'perte']);
  });
});
