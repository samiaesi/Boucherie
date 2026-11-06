import { DEFAULT_PRODUCTS, FAT_LABELS, FridgeItem, OrderItem, Product, animals, applyPools, availableOrigins, countriesIn, defaultOriginIndex, countryFlag, countryName, hasPriceRange, itemQty, lowestPrice, moveCountryStock, sumCountries, noOriginLeft, originLabel, originsOf, poolOf, readFridge, stockShortages } from './data';

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

describe('stockShortages', () => {
  const fridge = [{ id: 'moutons', name: 'Moutons', tracked: true, kg: 10, min: 0, max: 0, kgEach: 0 }] as FridgeItem[];
  const products = [
    { id: 'gigot', name_fr: 'Gigot', unit: 'kg', source: 'moutons' },
    { id: 'demi', name_fr: 'Demi-mouton', unit: 'kg', source: 'moutons' },
    { id: 'merlan', name_fr: 'Merlan', unit: 'kg', source: 'none', trackStock: true, stock: 3 },
    { id: 'sauce', name_fr: 'Sauce', unit: 'piece', source: 'none' },
  ] as Product[];
  const item = (productId: string, grams: number, qty = 1) => ({ productId, unit: 'kg', grams, qty }) as OrderItem;

  it('refuse plus que la réserve', () => {
    expect(stockShortages([item('demi', 12000)], products, fridge))
      .toEqual([{ name: 'Moutons', unit: 'kg', have: 10, need: 12 }]);
  });

  it('additionne les coupes de la même réserve', () => {
    expect(stockShortages([item('gigot', 6000), item('demi', 5000)], products, fridge)).toHaveLength(1);
  });

  it('accepte exactement le stock restant', () => {
    expect(stockShortages([item('gigot', 5000, 2)], products, fridge)).toEqual([]);
  });

  it('contrôle les produits suivis seuls et ignore les autres', () => {
    expect(stockShortages([item('merlan', 4000)], products, fridge).map(l => l.name)).toEqual(['Merlan']);
    expect(stockShortages([{ productId: 'sauce', unit: 'piece', qty: 99 } as OrderItem], products, fridge)).toEqual([]);
  });
});

describe('countryName', () => {
  it('traduit un pays connu et garde un pays écrit à la main', () => {
    expect(countryName('Inde', 'ar')).toBe('الهند');
    expect(countryName('Inde', 'fr')).toBe('Inde');
    expect(countryName('Australie', 'ar')).toBe('Australie');
  });
});

describe('Pays et prix', () => {
  const beef = { price: 3200, origins: [{ country: 'Espagne', price: 3800 }, { country: 'Algérie', price: 4200 }, { country: 'Brésil', price: 3200 }] };

  it('liste les pays avec leur prix', () => {
    expect(originsOf(beef)).toHaveLength(3);
    expect(originLabel(beef)).toBe('Espagne, Algérie, Brésil');
    expect(lowestPrice(beef)).toBe(3200);
    expect(hasPriceRange(beef)).toBe(true);
  });

  it('reprend l\'ancien champ à un seul pays et le prix du produit', () => {
    expect(originsOf({ price: 900, origin: 'Inde' })).toEqual([{ country: 'Inde', price: 900 }]);
    expect(hasPriceRange({ price: 900, origin: 'Inde' })).toBe(false);
  });

  it('garde le prix de base sans pays', () => {
    expect(originsOf({ price: 900 })).toEqual([]);
    expect(lowestPrice({ price: 900 })).toBe(900);
  });
});

describe('countryFlag', () => {
  it('trouve le drapeau d\'un pays de la liste', () => {
    expect(countryFlag('Algérie')).toBe('flags/dz.svg');
    expect(countryFlag('Brésil')).toBe('flags/br.svg');
  });

  it('ne donne aucun drapeau pour un pays écrit à la main', () => {
    expect(countryFlag('Australie')).toBe('');
  });
});

describe('Pays indisponible', () => {
  const beef = { price: 3100, origins: [{ country: 'Espagne', price: 3400, available: false }, { country: 'Algérie', price: 3800 }, { country: 'Brésil', price: 3100 }] };

  it('ne garde que les pays en vente', () => {
    expect(availableOrigins(beef).map(o => o.country)).toEqual(['Algérie', 'Brésil']);
    expect(noOriginLeft(beef)).toBe(false);
  });

  it('calcule le prix sans le pays retiré', () => {
    const noCheap = { ...beef, origins: [beef.origins[1], { country: 'Brésil', price: 3100, available: false }] };
    expect(lowestPrice(noCheap)).toBe(3800);
    expect(hasPriceRange(noCheap)).toBe(false);
  });

  it('signale un produit dont aucun pays n\'est en vente', () => {
    const none = { price: 100, origins: [{ country: 'Inde', price: 100, available: false }] };
    expect(noOriginLeft(none)).toBe(true);
    expect(lowestPrice(none)).toBe(100);
    expect(noOriginLeft({ price: 100 })).toBe(false);
  });
});

describe('countriesIn', () => {
  it('liste les pays en vente sans doublon et sans les pays retirés', () => {
    const list = countriesIn([
      { price: 1, origins: [{ country: 'Espagne', price: 1 }, { country: 'Brésil', price: 1, available: false }] },
      { price: 1, origin: 'Algérie' }, { price: 1, origin: 'Espagne' }, { price: 1 },
    ]);
    expect(list).toEqual(['Algérie', 'Espagne']);
  });
});

describe('Stock par pays', () => {
  const fridge = [{ id: 'moutons', name: 'Moutons', tracked: true, kg: 33, min: 0, max: 0, kgEach: 16, countries: { 'Algérie': 33, 'Espagne': 0 } }] as FridgeItem[];
  const sheep = { id: 'gigot', name_fr: 'Gigot', unit: 'kg', source: 'moutons', price: 3000, origins: [{ country: 'Algérie', price: 3000 }, { country: 'Espagne', price: 2800 }] } as Product;
  const item = (origin: string, grams: number) => ({ productId: 'gigot', unit: 'kg', grams, qty: 1, origin }) as OrderItem;

  it('refuse une vente Espagne sans toucher au stock Algérie', () => {
    expect(stockShortages([item('Espagne', 5000)], [sheep], fridge)).toEqual([{ name: 'Moutons (Espagne)', unit: 'kg', have: 0, need: 5 }]);
    expect(stockShortages([item('Algérie', 5000)], [sheep], fridge)).toEqual([]);
  });

  it('additionne les ventes d\'un même pays', () => {
    expect(stockShortages([item('Algérie', 20000), item('Algérie', 20000)], [sheep], fridge)).toHaveLength(1);
  });

  it('grise le pays vide sur le site', () => {
    const [applied] = applyPools([sheep], fridge);
    expect(availableOrigins(applied).map(o => o.country)).toEqual(['Algérie']);
  });

  it('compte chaque produit suivi seul par pays', () => {
    const fish = { id: 'merlan', name_fr: 'Merlan', unit: 'kg', source: 'none', trackStock: true, stock: 4, origins: [{ country: 'Inde', price: 1, stock: 4 }, { country: 'Espagne', price: 1, stock: 0 }] } as Product;
    const line = { productId: 'merlan', unit: 'kg', grams: 1000, qty: 1, origin: 'Espagne' } as OrderItem;
    expect(stockShortages([line], [fish], [])[0].name).toBe('Merlan (Espagne)');
  });

  it('déplace les kilos sans descendre sous zéro', () => {
    expect(moveCountryStock({ 'Algérie': 3 }, 'Algérie', -5)).toEqual({ 'Algérie': 0 });
    expect(moveCountryStock(undefined, 'Espagne', 10)).toEqual({ Espagne: 10 });
    expect(sumCountries({ 'Algérie': 33, Espagne: 7.5 })).toBe(40.5);
  });
});

describe('defaultOriginIndex', () => {
  const es = { country: 'Espagne', price: 1 }, dz = { country: 'Algérie', price: 1 }, br = { country: 'Brésil', price: 1 };

  it("présélectionne l'Algérie quand elle est en vente", () => {
    expect(defaultOriginIndex([es, dz, br])).toBe(1);
  });

  it('prend le premier pays en vente sinon', () => {
    expect(defaultOriginIndex([es, { ...dz, stock: 0 }, br])).toBe(0);
    expect(defaultOriginIndex([{ ...es, available: false }, { ...dz, available: false }, br])).toBe(2);
    expect(defaultOriginIndex([])).toBe(0);
  });
});

describe('Étiquette de gras', () => {
  it('existe en français et en arabe', () => {
    expect(FAT_LABELS.low.fr).toBe('Faible en gras');
    expect(FAT_LABELS.none.ar).toBe('بدون دهن');
  });
});
