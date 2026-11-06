import { CartLine, lineTotal } from './cart';
import { Product, availableOrigins, defaultOriginIndex, isOutOfStock, noOriginLeft } from './data';
import { customText, customTotal } from './special-custom';

export type MenuStyle = 'fete' | 'simple' | 'grill' | 'mer';

export const MENU_STYLES: { id: MenuStyle; label: string }[] = [
  { id: 'fete', label: 'Repas de fête' }, { id: 'simple', label: 'Menu simple' },
  { id: 'grill', label: 'Grillades' }, { id: 'mer', label: 'Poisson' },
];

/** Un plat du menu : à la pièce pour X personnes, ou au poids par personne. */
export interface Dish {
  product: string;
  /** Pièce entière : nombre de personnes servies */
  serves?: number;
  /** Vente au kg : grammes par personne */
  gramsEach?: number;
  /** Ingrédients ajoutés à une commande personnalisée, par nom français */
  extras?: string[];
  /** Accompagnement : le menu reste proposé si ce produit manque */
  side?: boolean;
}

export interface MenuRecipe {
  id: string;
  style: MenuStyle;
  name_fr: string;
  name_ar: string;
  dishes: Dish[];
  /** En dessous, le plat serait trop grand pour la table */
  minGuests?: number;
  /** Masqué depuis l'admin */
  hidden?: boolean;
}

const side = (product: string, gramsEach = 120): Dish => ({ product, gramsEach, side: true });
const recipe = (id: string, style: MenuStyle, name_fr: string, name_ar: string, dishes: Dish[], minGuests?: number): MenuRecipe =>
  ({ id, style, name_fr, name_ar, dishes, ...(minGuests ? { minGuests } : {}) });

/** Portions indicatives : à ajuster avec la boucherie. */
export const MENU_RECIPES: MenuRecipe[] = [
  // Repas de fête
  recipe('poulet-farci', 'fete', 'Poulets farcis', 'دجاج محشي', [{ product: 'poulet-farci', serves: 4 }, side('macedoine')]),
  recipe('ktaf-farci', 'fete', 'Épaule farcie', 'كتف محشية', [{ product: 'epaule-farcie', serves: 6 }, side('carottes')]),
  recipe('gigot-farci', 'fete', 'Gigot farci', 'فخذ خروف محشي', [{ product: 'gigot-farci', serves: 6 }, side('pois-carottes')]),
  recipe('dinde-farcie', 'fete', 'Dinde farcie', 'ديك رومي محشي', [{ product: 'dinde-farcie', serves: 10 }, side('macedoine')], 7),
  recipe('poitrine-farcie', 'fete', "Poitrine d'agneau farcie", 'صدر خروف محشي', [{ product: 'poitrine-farcie', serves: 6 }, side('haricots-verts')]),
  recipe('roti-farci', 'fete', 'Rôti de bœuf farci', 'روستي بقر محشي', [{ product: 'roti-boeuf-farci', serves: 6 }, side('carottes')]),
  recipe('tayhane-farci', 'fete', 'Tayhane farci', 'طيحان محشي', [{ product: 'tayhane-farci', serves: 4 }, side('epinards')]),
  recipe('cuisses-farcies', 'fete', 'Cuisses farcies', 'أفخاذ محشية', [{ product: 'cuisses-farcies', serves: 2 }, side('macedoine')]),
  recipe('kefta-farcie', 'fete', 'Kefta farcie', 'كفتة محشية', [{ product: 'kefta-farcie', serves: 4 }, side('petits-pois')]),
  recipe('paupiettes', 'fete', 'Paupiettes de bœuf', 'لفائف لحم بقري', [{ product: 'paupiettes-boeuf', serves: 3 }, side('haricots-verts')]),
  recipe('duo-farci', 'fete', 'Grande table : poulet et épaule farcis', 'مائدة كبيرة: دجاج وكتف محشية', [{ product: 'poulet-farci', serves: 8 }, { product: 'epaule-farcie', serves: 12 }, side('macedoine')], 10),
  recipe('mechoui', 'fete', 'Mouton pour méchoui', 'خروف للمشوي', [{ product: 'mechoui-mouton', serves: 20 }, side('pois-carottes')], 12),
  recipe('gigot-roti', 'fete', "Gigot d'agneau rôti", 'فخذ خروف مشوي', [{ product: 'gigot-agneau', gramsEach: 300 }, side('pois-carottes')]),
  recipe('epaule-rotie', 'fete', "Épaule d'agneau rôtie", 'كتف خروف مشوية', [{ product: 'epaule-agneau', gramsEach: 300 }, side('carottes')]),
  recipe('filet', 'fete', 'Filet de bœuf et haricots', 'فيليه بقر باللوبيا', [{ product: 'filet-boeuf', gramsEach: 180 }, side('haricots-verts')]),

  // Menus simples
  recipe('tajine', 'simple', 'Tajine de viande aux haricots', 'طاجين لحم باللوبيا', [{ product: 'boeuf-couscous', gramsEach: 180 }, { product: 'haricots-verts', gramsEach: 200 }]),
  recipe('poulet-olives', 'simple', 'Poulet farci aux olives', 'دجاج محشي بالزيتون', [{ product: 'poulet-farci', serves: 4, extras: ['Olives'] }]),
  recipe('kefta', 'simple', 'Kefta aux petits pois', 'كفتة بالجلبانة', [{ product: 'kefta', gramsEach: 180 }, { product: 'petits-pois', gramsEach: 150 }]),
  recipe('couscous-agneau', 'simple', "Couscous à l'agneau", 'كسكس بلحم الغنم', [{ product: 'agneau-couscous', gramsEach: 180 }, { product: 'carottes', gramsEach: 100 }, side('petits-pois', 60)]),
  recipe('couscous-poulet', 'simple', 'Couscous au poulet', 'كسكس بالدجاج', [{ product: 'cuisses-poulet', gramsEach: 250 }, { product: 'carottes', gramsEach: 100 }]),
  recipe('escalopes', 'simple', 'Escalopes de poulet aux épinards', 'إسكالوب دجاج بالسبانخ', [{ product: 'blanc-poulet', gramsEach: 180 }, { product: 'epinards', gramsEach: 150 }]),
  recipe('poulet-legumes', 'simple', 'Poulet et légumes', 'دجاج وخضر', [{ product: 'poulet-entier', gramsEach: 400 }, { product: 'pois-carottes', gramsEach: 150 }]),
  recipe('boulettes', 'simple', 'Boulettes de bœuf et légumes', 'كرات لحم بقري بالخضر', [{ product: 'hache-boeuf', gramsEach: 150 }, { product: 'macedoine', gramsEach: 150 }]),
  recipe('hachis-agneau', 'simple', "Haché d'agneau aux petits pois", 'لحم غنم مفروم بالجلبانة', [{ product: 'hache-agneau', gramsEach: 150 }, { product: 'petits-pois', gramsEach: 150 }]),
  recipe('foie', 'simple', "Foie d'agneau et légumes", 'كبدة الغنم بالخضر', [{ product: 'foie-agneau', gramsEach: 150 }, side('macedoine', 150)]),
  recipe('ailes', 'simple', 'Ailes de poulet et légumes', 'أجنحة دجاج بالخضر', [{ product: 'ailes-poulet', gramsEach: 250 }, side('pois-carottes', 150)]),

  // Grillades
  recipe('cotes', 'grill', 'Côtes et merguez', 'ضلوع ومرقاز', [{ product: 'cotelettes-agneau', gramsEach: 200 }, { product: 'merguez', gramsEach: 100 }]),
  recipe('brochettes-agneau', 'grill', "Brochettes d'agneau et merguez", 'أسياخ غنم ومرقاز', [{ product: 'brochettes-agneau', gramsEach: 200 }, { product: 'merguez', gramsEach: 100 }]),
  recipe('brochettes-poulet', 'grill', 'Brochettes de poulet et kefta', 'أسياخ دجاج وكفتة', [{ product: 'brochettes-poulet', gramsEach: 200 }, { product: 'kefta', gramsEach: 100 }]),
  recipe('mixte', 'grill', 'Grillade mixte', 'مشوي مشكل', [{ product: 'cotelettes-agneau', gramsEach: 120 }, { product: 'brochettes-poulet', gramsEach: 120 }, { product: 'merguez', gramsEach: 80 }, { product: 'kefta', gramsEach: 80 }]),
  recipe('entrecote', 'grill', 'Entrecôtes et merguez', 'أنتريكوت ومرقاز', [{ product: 'entrecote', gramsEach: 220 }, { product: 'merguez', gramsEach: 80 }]),
  recipe('marinees', 'grill', 'Brochettes marinées', 'أسياخ متبلة', [{ product: 'brochettes-marinees', serves: 4 }, side('macedoine')]),

  // Poisson
  recipe('poisson', 'mer', 'Poisson et légumes', 'سمك وخضر', [{ product: 'filet-merlu', gramsEach: 200 }, { product: 'macedoine', gramsEach: 150 }]),
  recipe('sardines', 'mer', 'Sardines et légumes', 'سردين وخضر', [{ product: 'sardines', gramsEach: 250 }, { product: 'pois-carottes', gramsEach: 150 }]),
  recipe('merlan', 'mer', 'Merlan aux épinards', 'ميرلان بالسبانخ', [{ product: 'merlan', gramsEach: 220 }, { product: 'epinards', gramsEach: 150 }]),
  recipe('calamar', 'mer', 'Calamars et légumes', 'كلمار وخضر', [{ product: 'calamar', gramsEach: 200 }, { product: 'macedoine', gramsEach: 120 }]),
  recipe('mer-fete', 'mer', 'Plateau de la mer', 'طبق بحري', [{ product: 'crevettes', gramsEach: 120 }, { product: 'calamar', gramsEach: 100 }, { product: 'filet-merlu', gramsEach: 120 }]),
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

  if (p.unit === 'kg') return null;
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
    if (!line) {
      if (dish.side) continue;
      return null;
    }
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

const matchesStyle = (r: MenuRecipe, style: MenuRequest['style']) =>
  style === 'all' || r.style === style || (style === 'simple' && r.style === 'mer');

/** Alterne les styles pour montrer tous les rayons dès les premiers menus. */
function alternate(menus: MenuProposal[]) {
  const groups = [...new Set(menus.map(m => m.style))].map(style => menus.filter(m => m.style === style));
  const longest = Math.max(0, ...groups.map(g => g.length));
  return Array.from({ length: longest }, (_, i) => groups.flatMap(g => g[i] ?? []));
}

/**
 * Menus possibles avec ce qui est disponible aujourd'hui : ceux au prix connu qui tiennent
 * dans le budget, du plus généreux au plus simple. Si aucun ne tient, le moins cher.
 */
export function planMenus(products: Product[], request: MenuRequest, recipes = MENU_RECIPES): MenuProposal[] {
  const all = recipes
    .filter(r => !r.hidden && matchesStyle(r, request.style) && request.guests >= (r.minGuests ?? 1))
    .map(r => propose(r, products, request))
    .filter((m): m is MenuProposal => !!m);
  const fitting = all.filter(m => !m.over)
    .sort((a, b) => Number(a.pending) - Number(b.pending) || b.total - a.total);
  if (fitting.length) return alternate(fitting).flat();
  return [...all].sort((a, b) => a.total - b.total).slice(0, 1);
}
