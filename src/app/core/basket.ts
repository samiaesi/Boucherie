import { CartLine } from './cart';
import { DEFAULT_WEIGHTS, Product, availableOrigins, isOutOfStock, noOriginLeft } from './data';
import { customTotal } from './special-custom';

const MAX_SUGGESTIONS = 3;

/** Rayons qui se complètent bien, du plus logique au moins logique. */
const GOES_WITH: Record<string, string[]> = {
  poulet: ['legumes', 'preparations'],
  agneau: ['preparations', 'legumes'],
  boeuf: ['legumes', 'preparations'],
  chouwa: ['preparations', 'legumes'],
  preparations: ['chouwa', 'legumes'],
  poissons: ['legumes'],
  abats: ['legumes'],
  speciales: ['legumes', 'preparations'],
  legumes: ['preparations', 'poissons'],
};

/** Ajout sans autre choix : ni pays à choisir, ni personnalisation, ni réservation. */
const simple = (p: Product) => p.available && !p.custom && !p.special && !isOutOfStock(p) && !noOriginLeft(p)
  && availableOrigins(p).length <= 1 && p.price > 0 && p.unit !== 'order';

export function quickLine(p: Product): Omit<CartLine, 'key'> {
  const origin = availableOrigins(p)[0];
  return {
    productId: p.id, name_fr: p.name_fr, name_ar: p.name_ar, unit: p.unit, price: origin?.price ?? p.price, qty: 1,
    ...(origin ? { origin: origin.country } : {}),
    grams: p.unit === 'kg' ? (p.weights?.length ? p.weights : DEFAULT_WEIGHTS)[0] : undefined,
    option_fr: p.options_fr?.[0], option_ar: p.options_ar?.[0] ?? p.options_fr?.[0],
  };
}

/** Produits à proposer pour compléter le panier : un par rayon d'abord, les plus demandés en tête. */
export function suggestProducts(lines: Pick<CartLine, 'productId'>[], products: Product[]) {
  const inCart = new Set(lines.map(l => l.productId));
  const categories = [...new Set(lines.flatMap(l => {
    const category = products.find(p => p.id === l.productId)?.category ?? '';
    return GOES_WITH[category] ?? [];
  }))];
  const byCategory = categories.map(c => products
    .filter(p => p.category === c && !inCart.has(p.id) && simple(p))
    .sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || a.order - b.order));
  const longest = Math.max(0, ...byCategory.map(list => list.length));
  const mixed = Array.from({ length: longest }, (_, i) => byCategory.flatMap(list => list[i] ?? [])).flat();
  return mixed.slice(0, MAX_SUGGESTIONS);
}

function rebuildLine(line: CartLine, products: Product[]): CartLine | null {
  const p = products.find(x => x.id === line.productId);
  if (!p || !p.available || isOutOfStock(p) || noOriginLeft(p)) return null;
  if (p.custom) {
    if (!line.pick) return null;
    const total = customTotal(p, line.pick);
    return { ...line, unit: total === null ? 'order' : 'piece', price: total ?? 0 };
  }
  const origins = availableOrigins(p);
  const origin = origins.find(o => o.country === line.origin);
  if (origins.length && !origin) return null;
  if (line.unit !== p.unit) return null;
  return { ...line, price: origin?.price ?? p.price };
}

/** Refait une commande avec les prix du jour, sans ce qui n'est plus disponible. */
export function rebuildBasket(saved: CartLine[], products: Product[]) {
  const lines = saved.map(l => rebuildLine(l, products)).filter((l): l is CartLine => !!l);
  return { lines, missing: saved.length - lines.length };
}
