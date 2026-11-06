import { CartLine } from './cart';
import { rebuildBasket, suggestProducts } from './basket';
import { DEFAULT_CUSTOM, Product } from './data';
import { loyaltyProgress, normalizeTel, pointsFor, validTel } from './loyalty';

const product = (id: string, category: string, extra: Partial<Product> = {}): Product => ({
  id, category, order: 1, available: true, unit: 'kg', price: 1000, name_fr: id, name_ar: id, desc_fr: '', desc_ar: '', ...extra,
});
const line = (extra: Partial<CartLine>): CartLine => ({ key: 'k', productId: 'x', name_fr: 'x', name_ar: 'x', unit: 'kg', price: 500, grams: 500, qty: 2, ...extra });

describe('Compléter le panier', () => {
  const products = [
    product('poulet', 'poulet'), product('haricots', 'legumes'), product('merguez', 'preparations', { featured: true }),
    product('kefta', 'preparations'), product('sardines', 'poissons'),
  ];

  it('propose ce qui va avec le panier, sans ce qui y est déjà', () => {
    expect(suggestProducts([{ productId: 'poulet' }], products).map(p => p.id)).toEqual(['haricots', 'merguez', 'kefta']);
    expect(suggestProducts([{ productId: 'poulet' }, { productId: 'merguez' }], products).map(p => p.id)).toEqual(['haricots', 'kefta']);
  });

  it('écarte les produits épuisés, masqués, sans prix, à réserver ou à choisir', () => {
    const list = [
      product('poulet', 'poulet'), product('a', 'legumes', { available: false }), product('b', 'legumes', { trackStock: true, stock: 0 }),
      product('c', 'legumes', { price: 0 }), product('d', 'legumes', { special: true }),
      product('e', 'legumes', { origins: [{ country: 'Algérie', price: 1 }, { country: 'Espagne', price: 2 }] }),
    ];
    expect(suggestProducts([{ productId: 'poulet' }], list)).toEqual([]);
  });

  it('ne propose rien sur un panier vide', () => {
    expect(suggestProducts([], products)).toEqual([]);
  });
});

describe('Recommander', () => {
  it('reprend la commande avec le prix du jour', () => {
    const { lines, missing } = rebuildBasket([line({ productId: 'a' })], [product('a', 'poulet', { price: 1200 })]);
    expect(missing).toBe(0);
    expect(lines[0]).toMatchObject({ price: 1200, qty: 2, grams: 500 });
  });

  it('retire ce qui n\'est plus disponible et le signale', () => {
    const saved = [line({ productId: 'a' }), line({ productId: 'b' }), line({ productId: 'gone' })];
    const { lines, missing } = rebuildBasket(saved, [product('a', 'poulet'), product('b', 'poulet', { trackStock: true, stock: 0 })]);
    expect(lines.map(l => l.productId)).toEqual(['a']);
    expect(missing).toBe(2);
  });

  it('retire un pays qui n\'est plus en vente', () => {
    const p = product('a', 'boeuf', { origins: [{ country: 'Algérie', price: 3000 }] });
    expect(rebuildBasket([line({ productId: 'a', origin: 'Brésil' })], [p]).missing).toBe(1);
    expect(rebuildBasket([line({ productId: 'a', origin: 'Algérie' })], [p]).lines[0].price).toBe(3000);
  });

  it('recalcule une commande personnalisée', () => {
    const p = product('f', 'speciales', { unit: 'order', special: true, price: 1500, custom: { ...DEFAULT_CUSTOM, meats: [{ fr: 'Poulet', ar: 'دجاج', price: 1000 }] } });
    const saved = line({ productId: 'f', unit: 'piece', grams: undefined, price: 1, pick: { meat: 0, grams: 500, extras: [] } });
    expect(rebuildBasket([saved], [p]).lines[0]).toMatchObject({ unit: 'piece', price: 2000 });
  });

});

describe('Carte de fidélité', () => {
  it('reconnaît le même numéro écrit autrement', () => {
    const local = '0555123456';
    expect(['0555 12 34 56', '+213 555 12 34 56', '00213555123456', '213555123456'].map(normalizeTel)).toEqual([local, local, local, local]);
    expect(validTel('05 55 12 34 56')).toBe(true);
    expect(validTel('123')).toBe(false);
  });

  it('compte un point par tranche complète', () => {
    expect(pointsFor(2599, 100)).toBe(25);
    expect(pointsFor(99, 100)).toBe(0);
    expect(pointsFor(1000, 0)).toBe(0);
  });

  it('limite l\'avancement à 100 %', () => {
    expect(loyaltyProgress(250, 500)).toBe(50);
    expect(loyaltyProgress(900, 500)).toBe(100);
  });
});
