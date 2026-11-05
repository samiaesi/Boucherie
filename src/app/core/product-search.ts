import { Category, Product } from './data';

/** Sans accents ni majuscules : « Bœuf » se trouve en tapant « boeuf ». */
export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/gi, 'oe').toLowerCase();

/** Référence saisie dans la fiche, sinon celle tirée de l'identifiant du produit. */
export const productRef = (p: Pick<Product, 'id' | 'reference'>) => p.reference?.trim() || p.id.toUpperCase();

export function matchesProduct(p: Product, text: string, categories: Category[]) {
  const c = categories.find(x => x.id === p.category);
  const haystack = normalize([p.name_fr, p.name_ar, productRef(p), p.category, c?.name_fr, c?.name_ar].filter(Boolean).join(' '));
  return normalize(text).split(/\s+/).filter(Boolean).every(word => haystack.includes(word));
}

/** Filtre par rayon puis par mots : tous les mots tapés doivent correspondre. */
export function searchProducts<T>(items: T[], product: (item: T) => Product, text: string, category: string, categories: Category[]) {
  return items.filter(item => {
    const p = product(item);
    return (!category || p.category === category) && matchesProduct(p, text, categories);
  });
}

/** Produit qui porte déjà cette référence, sans tenir compte des majuscules. */
export function referenceTakenBy(reference: string, id: string | null, products: Product[]) {
  const wanted = normalize(reference.trim());
  return wanted ? products.find(p => p.id !== id && normalize(productRef(p)) === wanted) : undefined;
}
