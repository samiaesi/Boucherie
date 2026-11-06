import { DEFAULT_PRODUCTS, Product } from './data';
import { choiceIcon, customReady, customText, customTotal } from './special-custom';

const product = (price: number, meat: number, extra: number): Product => ({
  id: 'x', category: 'speciales', order: 1, available: true, special: true, unit: 'order', price,
  name_fr: 'Poulet farci', name_ar: 'دجاج محشي', desc_fr: '', desc_ar: '',
  custom: {
    meats: [{ fr: 'Poulet', ar: 'دجاج', price: meat }, { fr: 'Bœuf', ar: 'لحم بقر', price: meat * 2 }],
    grams: [250, 500],
    extras: [{ fr: 'Champignons', ar: 'فطر', price: extra }, { fr: 'Olives', ar: 'زيتون', price: 0 }],
  },
});

describe('Personnalisation des commandes spéciales', () => {
  it('additionne la base cachée, la viande au poids et les ingrédients', () => {
    expect(customTotal(product(1000, 800, 150), { meat: 1, grams: 500, extras: [0, 1] })).toBe(1000 + 800 + 150);
  });

  it('change avec chaque choix du client', () => {
    const p = product(1000, 800, 150);
    expect(customTotal(p, { meat: 0, grams: 250, extras: [] })).toBe(1200);
    expect(customTotal(p, { meat: 0, grams: 500, extras: [] })).toBe(1400);
    expect(customTotal(p, { meat: 0, grams: 500, extras: [0] })).toBe(1550);
  });

  it('reste à confirmer tant qu\'un prix manque', () => {
    expect(customTotal(product(0, 800, 150), { meat: 0, grams: 250, extras: [] })).toBeNull();
    expect(customTotal(product(1000, 0, 150), { meat: 0, grams: 250, extras: [] })).toBeNull();
    expect(customReady(product(1000, 800, 0))).toBe(true);
  });

  it('résume les choix dans la langue du client, sans la main-d\'œuvre', () => {
    const p = product(1000, 800, 150);
    expect(customText(p, { meat: 1, grams: 500, extras: [0, 1] }, 'fr')).toBe('Bœuf 500 g · Champignons · Olives');
    expect(customText(p, { meat: 0, grams: 250, extras: [] }, 'ar')).toBe('دجاج 250 غ');
  });

  it('propose la farce sur les produits farcis du catalogue', () => {
    const custom = DEFAULT_PRODUCTS.find(p => p.id === 'poulet-farci')!.custom!;
    expect(custom.meats.map(m => m.fr)).toEqual(['Poulet', 'Bœuf']);
    expect(custom.extras.map(e => e.fr)).toEqual(['Champignons', 'Fromage', 'Oignon', 'Olives']);
    expect(DEFAULT_PRODUCTS.find(p => p.id === 'boudin-special')!.custom).toBeUndefined();
  });

  it('donne un pictogramme à chaque choix, même ajouté dans l\'admin', () => {
    expect(['Poulet', 'Bœuf', 'Champignons', 'Fromage', 'Oignon', 'Olives', 'Persil'].map(choiceIcon))
      .toEqual(['poulet', 'boeuf', 'champignon', 'fromage', 'oignon', 'olive', 'supplement']);
  });

  it('ajoute le poulet entier sans os au rayon poulet', () => {
    expect(DEFAULT_PRODUCTS.find(p => p.id === 'poulet-sans-os')?.category).toBe('poulet');
  });
});
