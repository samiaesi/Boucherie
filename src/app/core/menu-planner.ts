import { CartLine, lineTotal } from './cart';
import { Product, availableOrigins, defaultOriginIndex, isOutOfStock, noOriginLeft } from './data';
import { customText, customTotal } from './special-custom';

export type MenuStyle = 'fete' | 'simple';

/** Un plat du menu : à la pièce pour X personnes, ou au poids par personne. */
interface Dish {
  product: string;
  /** Pièce entière : nombre de personnes servies */
  serves?: number;
  /** Vente au kg : grammes par personne */
  gramsEach?: number;
  /** Ingrédients ajoutés à une commande personnalisée, par nom français */
  extras?: string[];
}

interface MenuRecipe {
  id: string;
  style: MenuStyle;
  name_fr: string;
  name_ar: string;
  dishes: Dish[];
  /** En dessous, le plat serait trop grand pour la table */
  minGuests?: number;
}

/** Portions indicatives : à ajuster avec la boucherie. */
export const MENU_RECIPES: MenuRecipe[] = [
  { id: 'poulet-farci', style: 'fete', name_fr: 'Poulets farcis', name_ar: 'دجاج محشي', dishes: [{ product: 'poulet-farci', serves: 4 }] },
  { id: 'ktaf-farci', style: 'fete', name_fr: 'Épaule farcie', name_ar: 'كتف محشية', dishes: [{ product: 'epaule-farcie', serves: 6 }] },
  { id: 'gigot-farci', style: 'fete', name_fr: 'Gigot farci', name_ar: 'فخذ خروف محشي', dishes: [{ product: 'gigot-farci', serves: 6 }] },
  { id: 'dinde-farcie', style: 'fete', name_fr: 'Dinde farcie', name_ar: 'ديك رومي محشي', minGuests: 7, dishes: [{ product: 'dinde-farcie', serves: 10 }] },
  { id: 'cotes', style: 'fete', name_fr: 'Côtes et merguez', name_ar: 'ضلوع ومرقاز', dishes: [{ product: 'cotelettes-agneau', gramsEach: 200 }, { product: 'merguez', gramsEach: 100 }] },
  { id: 'poisson', style: 'simple', name_fr: 'Poisson et légumes', name_ar: 'سمك وخضر', dishes: [{ product: 'filet-merlu', gramsEach: 200 }, { product: 'macedoine', gramsEach: 150 }] },
  { id: 'tajine', style: 'simple', name_fr: 'Tajine de viande aux haricots', name_ar: 'طاجين لحم باللوبيا', dishes: [{ product: 'boeuf-couscous', gramsEach: 180 }, { product: 'haricots-verts', gramsEach: 200 }] },
  { id: 'poulet-olives', style: 'simple', name_fr: 'Poulet farci aux olives', name_ar: 'دجاج محشي بالزيتون', dishes: [{ product: 'poulet-farci', serves: 4, extras: ['Olives'] }] },
  { id: 'kefta', style: 'simple', name_fr: 'Kefta aux petits pois', name_ar: 'كفتة بالجلبانة', dishes: [{ product: 'kefta', gramsEach: 180 }, { product: 'petits-pois', gramsEach: 150 }] },
  { id: 'sardines', style: 'simple', name_fr: 'Sardines et légumes', name_ar: 'سردين وخضر', dishes: [{ product: 'sardines', gramsEach: 250 }, { product: 'pois-carottes', gramsEach: 150 }] },
];

export interface MenuRequest {
  guests: number;
  /** Budget total en DA, 0 = sans limite */
  budget: number;
  style: MenuStyle | 'all';
}

export interface MenuProposal {
  id: string;
  style: MenuStyle;
  name_fr: string;
  name_ar: string;
  lines: Omit<CartLine, 'key'>[];
  images: string[];
  /** Montant connu */
  total: number;
  /** Au moins un plat dont le prix reste à confirmer */
  pending: boolean;
  /** Montant connu au-dessus du budget */
  over: boolean;
}

const MAX_PROPOSALS = 6;
const roundGrams = (g: number) => Math.ceil(g / 50) * 50;

function dishLine(p: Product, dish: Dish, guests: number): Omit<CartLine, 'key'> | null {
  if (!p.available || isOutOfStock(p) || noOriginLeft(p)) return null;
  const origins = p.custom ? [] : availableOrigins(p);
  const origin = origins[defaultOriginIndex(origins)];
  const base = {
    productId: p.id, name_fr: p.name_fr, name_ar: p.name_ar,
    ...(p.special ? { special: true } : {}),
    ...(origin ? { origin: origin.country } : {}),
  };

  if (dish.gramsEach) {
    if (p.unit !== 'kg' || !p.price) return null;
    const grams = roundGrams(dish.gramsEach * guests);
    if (p.trackStock && (origin?.stock ?? p.stock ?? 0) < grams / 1000) return null;
    return { ...base, unit: 'kg', price: origin?.price ?? p.price, grams, qty: 1 };
  }

  const qty = Math.ceil(guests / (dish.serves ?? 1));
  if (!p.custom) return { ...base, unit: p.unit, price: p.unit === 'piece' ? (origin?.price ?? p.price) : 0, qty };
  const pick = {
    meat: 0,
    grams: p.custom.grams[1] ?? p.custom.grams[0] ?? 0,
    extras: (dish.extras ?? []).map(name => p.custom!.extras.findIndex(e => e.fr === name)).filter(i => i >= 0),
  };
  const total = customTotal(p, pick);
  return {
    ...base, unit: total === null ? 'order' : 'piece', price: total ?? 0, qty,
    option_fr: customText(p, pick, 'fr'), option_ar: customText(p, pick, 'ar'),
  };
}

function propose(recipe: MenuRecipe, products: Product[], request: MenuRequest): MenuProposal | null {
  const lines: Omit<CartLine, 'key'>[] = [];
  const images: string[] = [];
  for (const dish of recipe.dishes) {
    const product = products.find(p => p.id === dish.product);
    const line = product && dishLine(product, dish, request.guests);
    if (!line) return null;
    lines.push(line);
    if (product.image) images.push(product.image);
  }
  const total = lines.reduce((sum, l) => sum + lineTotal({ ...l, key: '' }), 0);
  return {
    id: recipe.id, style: recipe.style, name_fr: recipe.name_fr, name_ar: recipe.name_ar, lines, images, total,
    pending: lines.some(l => l.unit === 'order'),
    over: request.budget > 0 && total > request.budget,
  };
}

/**
 * Menus possibles avec ce qui est disponible aujourd'hui : d'abord ceux au prix connu qui
 * tiennent dans le budget, du plus généreux au plus simple. Si aucun ne tient, le moins cher.
 */
export function planMenus(products: Product[], request: MenuRequest): MenuProposal[] {
  const all = MENU_RECIPES
    .filter(r => (request.style === 'all' || r.style === request.style) && request.guests >= (r.minGuests ?? 1))
    .map(r => propose(r, products, request))
    .filter((m): m is MenuProposal => !!m);
  const fitting = all.filter(m => !m.over)
    .sort((a, b) => Number(a.pending) - Number(b.pending) || b.total - a.total);
  if (fitting.length) return fitting.slice(0, MAX_PROPOSALS);
  return [...all].sort((a, b) => a.total - b.total).slice(0, 1);
}
