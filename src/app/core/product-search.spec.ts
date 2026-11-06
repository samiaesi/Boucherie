import { Category, Product } from './data';
import { matchesProduct, normalize, productRef, referenceTakenBy, searchProducts } from './product-search';

const categories = [
  { id: 'boeuf', name_fr: 'Bœuf', name_ar: 'لحم البقر' },
  { id: 'agneau', name_fr: 'Agneau', name_ar: 'لحم الغنم' },
] as Category[];
const products = [
  { id: 'entrecote', name_fr: 'Entrecôte', name_ar: 'أنتريكوت', category: 'boeuf', reference: 'B-101', origin: 'Espagne' },
  { id: 'gigot-agneau', name_fr: "Gigot d'agneau", name_ar: 'فخذ خروف', category: 'agneau' },
] as Product[];
const find = (text: string, category = '') => searchProducts(products, p => p, text, category, categories).map(p => p.id);

describe('Recherche de produits', () => {
  it('ignore les accents et les majuscules', () => {
    expect(normalize('Bœuf ÉPAULE')).toBe('boeuf epaule');
    expect(find('entrecote')).toEqual(['entrecote']);
  });

  it('cherche par référence, nom français ou arabe', () => {
    expect(find('b-101')).toEqual(['entrecote']);
    expect(find('GIGOT-AGNEAU')).toEqual(['gigot-agneau']);
    expect(find('فخذ')).toEqual(['gigot-agneau']);
  });

  it('cherche par nom de rayon', () => {
    expect(find('boeuf')).toEqual(['entrecote']);
    expect(find('الغنم')).toEqual(['gigot-agneau']);
  });

  it('cherche par pays d\'origine', () => {
    expect(find('espagne')).toEqual(['entrecote']);
  });

  it('demande que tous les mots correspondent', () => {
    expect(find('gigot agneau')).toEqual(['gigot-agneau']);
    expect(find('gigot boeuf')).toEqual([]);
  });

  it('filtre par rayon et renvoie tout sans recherche', () => {
    expect(find('', 'agneau')).toEqual(['gigot-agneau']);
    expect(find('  ')).toHaveLength(2);
    expect(matchesProduct(products[0], '', categories)).toBe(true);
  });
});

describe('Référence', () => {
  it('utilise la référence saisie, sinon l\'identifiant', () => {
    expect(productRef(products[0])).toBe('B-101');
    expect(productRef(products[1])).toBe('GIGOT-AGNEAU');
  });

  it('signale une référence déjà utilisée par un autre produit', () => {
    expect(referenceTakenBy('b-101', 'gigot-agneau', products)?.id).toBe('entrecote');
    expect(referenceTakenBy('B-101', 'entrecote', products)).toBeUndefined();
    expect(referenceTakenBy('', null, products)).toBeUndefined();
  });
});
