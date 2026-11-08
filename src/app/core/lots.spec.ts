import { FridgeItem, Product } from './data';
import { Lot, lotNumber, lotTargets, searchLots, supplierNames, parseWeights, lotParts, linesCost, lotOrigins } from './lots';

const lot = (over: Partial<Lot>): Lot => ({
  id: '1', matricule: 'LOT-2026-0001', target: { kind: 'fridge', id: 'moutons', name: 'Moutons', unit: 'kg' },
  qty: 120, arrivalDate: '2026-11-05', supplierName: 'Ferme Benali', supplierRef: 'BL-778', note: '', ...over,
});

describe('Matricule', () => {
  it('numérote par année sur quatre chiffres', () => {
    expect(lotNumber(2026, 7)).toBe('LOT-2026-0007');
    expect(lotNumber(2026, 12345)).toBe('LOT-2026-12345');
  });
});

describe('lotTargets', () => {
  const fridge = [{ id: 'moutons', name: 'Moutons', tracked: true, kg: 0, min: 0, max: 0, kgEach: 0 }] as FridgeItem[];

  it('propose les réserves, les coupes et les produits suivis seuls, pas le mouton entier', () => {
    const products = [
      { id: 'merlan', name_fr: 'Merlan', unit: 'kg', trackStock: true, source: 'none' },
      { id: 'gigot', name_fr: 'Gigot', unit: 'kg', trackStock: false, source: 'moutons' },
      { id: 'mouton-entier', name_fr: 'Mouton entier', unit: 'kg', source: 'moutons' },
      { id: 'sauce', name_fr: 'Sauce', unit: 'kg', trackStock: false, source: 'none' },
    ] as Product[];
    expect(lotTargets(products, fridge).map(t => [t.kind, t.id])).toEqual([['fridge', 'moutons'], ['product', 'merlan'], ['product', 'gigot']]);
  });

  it('lit les poids tapés un par un', () => {
    expect(parseWeights('21 23,5 24 22')).toEqual([21, 23.5, 24, 22]);
    expect(parseWeights('21, 23, 24;22')).toEqual([21, 23, 24, 22]);
    expect(parseWeights('')).toEqual([]);
  });
});

describe('supplierNames', () => {
  it('retire les doublons sans tenir compte des majuscules', () => {
    const names = supplierNames([lot({}), lot({ supplierName: ' ferme benali ' }), lot({ supplierName: 'Abattoir SBA' })]);
    expect(names).toEqual(['Abattoir SBA', 'Ferme Benali']);
  });
});

describe('searchLots', () => {
  const lots = [lot({}), lot({ id: '2', matricule: 'LOT-2026-0002', supplierName: 'Abattoir SBA', supplierRef: 'X9' })];

  it('cherche par matricule, fournisseur, référence ou article', () => {
    expect(searchLots(lots, '0002').map(l => l.id)).toEqual(['2']);
    expect(searchLots(lots, 'benali').map(l => l.id)).toEqual(['1']);
    expect(searchLots(lots, 'x9').map(l => l.id)).toEqual(['2']);
    expect(searchLots(lots, 'moutons')).toHaveLength(2);
  });

  it('renvoie tout si la recherche est vide', () => {
    expect(searchLots(lots, '  ')).toHaveLength(2);
  });
});

describe('arrivage bête par bête', () => {
  const lines = [
    { kg: 21, origin: 'Algérie', price: 1400 }, { kg: 23.5, origin: 'Espagne', price: 1200 }, { kg: 24, origin: 'Algérie' },
  ];

  it('regroupe les bêtes par pays pour le stock', () => {
    expect(lotParts({ qty: 68.5, lines })).toEqual([{ origin: 'Algérie', qty: 45, beasts: 2 }, { origin: 'Espagne', qty: 23.5, beasts: 1 }]);
    expect(lotParts({ qty: 90, origin: 'Algérie', beasts: 4 })).toEqual([{ origin: 'Algérie', qty: 90, beasts: 4 }]);
  });

  it('calcule le coût des bêtes dont le prix est connu', () => {
    expect(linesCost(lines)).toBe(21 * 1400 + 23.5 * 1200);
  });

  it('liste les pays sans doublon', () => {
    expect(lotOrigins({ lines })).toBe('Algérie, Espagne');
    expect(lotOrigins({ origin: 'Brésil' })).toBe('Brésil');
  });
});

