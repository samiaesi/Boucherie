import { FridgeItem, Order, Product } from './data';
import { Lot } from './lots';
import { CutRecord, StockExit, availableQty, beastWeight, chainSummary, cutNumber, cutWaste, cutsOf, exitNumber, reserveCountries, searchExits, shelfAlerts, shelfLines, splitRegister, targetCountries } from './stock-chain';

const product = (over: Partial<Product>) => ({
  id: 'p', name_fr: 'Poulet', category: 'volaille', unit: 'kg', source: 'none', available: true, trackStock: true, stock: 10, stockAlert: 2, stockMax: 0, order: 1, ...over,
}) as Product;

const moutons = { id: 'moutons', name: 'Moutons', tracked: true, kg: 40, min: 50, max: 300, kgEach: 20, whole: 2, wholeBy: { Algérie: 1.5, Espagne: 0.5 }, countries: { Algérie: 30, Espagne: 10 } } as FridgeItem;

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

  it('le mouton entier prend le poids des bêtes entières', () => {
    const [line] = shelfLines([product({ id: 'mouton-entier', source: 'moutons', trackStock: false })], [moutons]);
    expect([line.state, line.qty]).toEqual(['remplir', 40]);
  });

  it('plus de mouton entier quand il ne reste qu\'une demi-bête, mais encore un demi-mouton', () => {
    const half = { ...moutons, whole: 0.5, wholeBy: undefined };
    const [whole, demi] = shelfLines([product({ id: 'mouton-entier', source: 'moutons', order: 1 }), product({ id: 'demi-mouton', source: 'moutons', order: 2 })], [half]);
    expect([whole.product.id, whole.state, demi.product.id, demi.state]).toEqual(['mouton-entier', 'vide', 'demi-mouton', 'remplir']);
  });

  it('compte les alertes par rayon', () => {
    const cats = [{ id: 'volaille', order: 1, icon: 'poulet', name_fr: 'Volaille', name_ar: '' }, { id: 'vide', order: 2, icon: '', name_fr: 'Vide', name_ar: '' }];
    expect(shelfAlerts([product({ stock: 0 }), product({ id: 'b' })], [], cats).map(t => [t.total, t.alerts])).toEqual([[2, 1], [0, 0]]);
  });
});

describe('découpe', () => {
  const cut = (over: Partial<CutRecord>) => ({
    id: 'c', kind: 'decoupe', matricule: 'DEC-2026-0001', reserve: { id: 'moutons', name: 'Moutons' }, beasts: 1, kg: 22,
    cuts: [{ id: 'gigot', name: 'Gigot', kg: 6 }, { id: 'cotes', name: 'Côtes', kg: 4 }], waste: 12, date: '2026-11-08', note: '', ...over,
  }) as CutRecord;

  it('numérote les découpes et calcule les os', () => {
    expect(cutNumber(2026, 3)).toBe('DEC-2026-0003');
    expect(cutWaste(22, [{ kg: 6 }, { kg: 4 }, { kg: 9 }])).toBe(3);
    expect(cutWaste(10, [{ kg: 12 }])).toBe(-2);
    expect(cutWaste(35, [{ kg: 20 }, { kg: 5 }], 8)).toBe(2);
  });

  it('range les découpes à part dans le registre', () => {
    expect(splitRegister([lot({}), exit({}), cut({})]).cuts).toHaveLength(1);
  });

  it('liste les coupes de la réserve, sans le mouton entier ni les autres animaux', () => {
    const products = [
      product({ id: 'gigot-agneau', source: 'moutons' }), product({ id: 'mouton-entier', source: 'moutons' }),
      product({ id: 'merguez', source: 'none' }), product({ id: 'souris', source: 'moutons', carcass: 'cut' }),
    ];
    expect(cutsOf(moutons, products).map(p => p.id)).toEqual(['gigot-agneau', 'souris']);
  });

  it('donne le poids moyen des bêtes restantes, par pays', () => {
    expect(beastWeight(moutons)).toBe(20);
    expect(beastWeight(moutons, 'Algérie')).toBe(20);
    expect(beastWeight({ ...moutons, whole: 0, wholeBy: undefined })).toBe(20);
    expect(reserveCountries(moutons)).toEqual(['Algérie', 'Espagne']);
  });

  it('compte les os de découpe dans le déstockage de la chaîne', () => {
    const s = chainSummary({ lots: [], exits: [], cuts: [cut({}), cut({ id: 'x', cancelled: true })], fridge: [moutons], products: [], orders: [], today: '2026-11-08' });
    expect([s.cuts.count, s.cuts.beasts, s.cuts.kg]).toEqual([1, 1, 10]);
    expect([s.exits.count, s.exits.kg, s.exits.byReason[0].reason]).toEqual([1, 12, 'decoupe']);
    expect(s.fridge.beasts).toBe(2);
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
