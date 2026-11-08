import { Carcass, carcassesOf, cleanCarcass, rebuildCarcasses, removeOldest, sellCarcass, withCarcasses } from './carcasses';
import { FridgeItem } from './data';
import { Lot } from './lots';

const fridge = (over: Partial<FridgeItem> = {}) => ({ id: 'moutons', name: 'Moutons', tracked: true, kg: 0, min: 0, max: 0, kgEach: 20, ...over }) as FridgeItem;
const c = (id: string, kg: number, over: Partial<Carcass> = {}): Carcass => ({ id, kg, origin: 'Algérie', ...over });

describe('carcasses', () => {
  it('recalcule bêtes, kilos et pays à partir des carcasses', () => {
    const f = withCarcasses(fridge({ countries: { Espagne: 5 } }), [c('a', 35), c('b', 11, { half: true }), c('e', 20, { origin: 'Espagne' })]);
    expect([f.whole, f.kg, f.countries, f.wholeBy]).toEqual([2.5, 66, { Espagne: 20, Algérie: 46 }, { Espagne: 1, Algérie: 1.5 }]);
  });

  it('fabrique des carcasses au poids moyen pour un ancien frigo', () => {
    const list = carcassesOf(fridge({ kg: 50, whole: 2.5, wholeBy: { Algérie: 2.5 }, countries: { Algérie: 50 } }));
    expect(list.map(x => [x.kg, !!x.half])).toEqual([[20, false], [20, false], [10, true]]);
  });

  it('retrouve les vraies bêtes dans le dernier arrivage', () => {
    const lot = {
      id: 'l', matricule: 'LOT-2026-0001', target: { kind: 'fridge', id: 'moutons', name: 'Moutons', unit: 'kg' }, qty: 83, arrivalDate: '2026-11-08',
      supplierName: '', supplierRef: '', note: '', lines: [{ kg: 35, origin: 'Algérie', price: 3500 }, { kg: 22, origin: 'Algérie' }, { kg: 26, origin: 'Algérie' }],
    } as Lot;
    const list = rebuildCarcasses(fridge({ kg: 83, whole: 3, wholeBy: { Algérie: 3 }, countries: { Algérie: 83 } }), [lot]);
    expect(list.map(x => [x.id, x.kg, x.n, x.price])).toEqual([
      ['LOT-2026-0001-1', 35, 1, 3500], ['LOT-2026-0001-2', 22, 2, undefined], ['LOT-2026-0001-3', 26, 3, undefined],
    ]);
  });

  it('vend la carcasse au poids le plus proche de la commande', () => {
    const list = [c('a', 35), c('b', 22), c('d', 26)];
    expect(sellCarcass(list, 1, 'Algérie', 25)!.map(x => x.id)).toEqual(['a', 'b']);
    expect(sellCarcass(list, 1, 'Espagne', 24)).toBeNull();
  });

  it('un demi-mouton coupe une carcasse en deux, puis prend la demi restante', () => {
    const once = sellCarcass([c('a', 22)], 0.5, undefined, 11)!;
    expect(once).toEqual([{ id: 'a', kg: 11, origin: 'Algérie', half: true }]);
    expect(sellCarcass(once, 0.5, undefined, 11)).toEqual([]);
    expect(sellCarcass(once, 1, undefined, 22)).toBeNull();
  });

  it('retire les bêtes les plus anciennes d\'abord', () => {
    expect(removeOldest([c('old', 20), c('new', 25)], 1)!.map(x => x.id)).toEqual(['new']);
    expect(removeOldest([c('a', 20)], 0.5)).toEqual([{ id: 'a', kg: 10, origin: 'Algérie', half: true }]);
    expect(removeOldest([c('a', 20)], 2)).toBeNull();
  });

  it('enlève les champs vides avant Firebase', () => {
    expect(cleanCarcass({ id: 'x', kg: 2, origin: undefined, half: undefined })).toEqual({ id: 'x', kg: 2 });
  });

  it('un reste de découpe compte en kilos mais pas comme une bête, et ne se vend pas en entier', () => {
    const rest = c('r', 10, { part: true });
    const f = withCarcasses(fridge(), [c('a', 22), rest]);
    expect([f.whole, f.kg]).toEqual([1, 32]);
    expect(sellCarcass([rest], 1, undefined, 10)).toBeNull();
    expect(removeOldest([rest, c('a', 22)], 1)!.map(x => x.id)).toEqual(['r']);
  });
});
