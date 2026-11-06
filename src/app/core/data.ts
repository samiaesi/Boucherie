// Types, données par défaut (affichées tant que Firestore est vide)
// et illustrations par catégorie, partagés par le site et l'admin.

export type Lang = 'fr' | 'ar';
export type Unit = 'kg' | 'piece' | 'order';
export type OrderStatus = 'nouveau' | 'confirmé' | 'prêt' | 'en livraison' | 'livré' | 'récupéré' | 'annulé';

export interface Product {
  id: string;
  category: string;
  order: number;
  available: boolean;
  /** Référence interne, saisie dans la fiche produit */
  reference?: string;
  /** Ancien champ : un seul pays d'origine */
  origin?: string;
  /** Pays d'origine proposés au client, chacun avec son prix */
  origins?: ProductOrigin[];
  price: number;
  unit: Unit;
  name_fr: string;
  name_ar: string;
  desc_fr: string;
  desc_ar: string;
  image?: string;
  /** Poids proposés en grammes (vente au kg) */
  weights?: number[];
  /** Découpes proposées : entier, escalopes, haché… */
  options_fr?: string[];
  options_ar?: string[];
  /** Affiché dans « Les coupes préférées » */
  featured?: boolean;
  /** Suivi du stock activé pour ce produit */
  trackStock?: boolean;
  /** Quantité en stock : en kg pour la vente au kg, en pièces sinon */
  stock?: number;
  /** Stock minimum : en dessous, alerte de réapprovisionnement */
  stockAlert?: number;
  /** Stock maximum : sert à calculer la quantité à racheter */
  stockMax?: number;
  /** Date de retour prévue (AAAA-MM-JJ), annoncée au client quand le produit est épuisé */
  restockDate?: string;
  /** Réserve du frigo qui alimente ce produit ; 'none' pour un stock propre au produit */
  source?: string;
}

/**
 * Réserve du frigo pour un animal, comptée en kg : un mouton se vend entier, en moitié
 * ou découpé, et chaque vente retire son poids de la même réserve.
 */
export interface FridgeItem {
  id: string;
  name: string;
  /** Vrai quand la réserve pilote le stock des produits reliés */
  tracked: boolean;
  /** Poids disponible */
  kg: number;
  min: number;
  max: number;
  /** Poids moyen d'une bête en kg, pour afficher l'équivalent en bêtes */
  kgEach: number;
  /** Date de retour annoncée aux clients quand la réserve est vide */
  restockDate?: string;
  /** Pictogramme sur la porte du frigo (clé de ICONS) */
  icon?: string;
  /** Frigo de produits : rayons rangés dedans, chaque produit garde son propre stock */
  rayons?: string[];
  /** Kilos par pays d'origine : quand il existe, chaque pays a son propre stock */
  countries?: Record<string, number>;
}

export interface Category {
  id: string;
  order: number;
  icon: string;
  name_fr: string;
  name_ar: string;
  image?: string;
}

export interface Offer {
  id: string;
  order: number;
  available: boolean;
  featured: boolean;
  price: number;
  name_fr: string;
  name_ar: string;
  unit_fr: string;
  unit_ar: string;
  items_fr: string[];
  items_ar: string[];
}

export interface Settings {
  /** Nom commercial */
  name_fr: string;
  name_ar: string;
  /** Raison sociale, affichée en pied de page */
  company: string;
  /** Identifiants légaux imprimés sur les factures */
  nif: string;
  nis: string;
  rc: string;
  ai: string;
  /** Taux de TVA en %, compris dans les prix (0 = pas de TVA sur la facture) */
  vatRate: number;
  /** Droit de timbre en % sur les factures pro payées en espèces (0 = aucun) */
  stampRate: number;
  address_fr: string;
  address_ar: string;
  /** Lien de la fiche Google Maps */
  mapLink: string;
  phone: string;
  whatsapp: string;
  /** Photos du site (data URL JPEG), choisies depuis l'admin */
  heroImage?: string;
  aboutImage?: string;
  /** Livraison proposée au client */
  deliveryEnabled: boolean;
  /** Lieux de livraison proposés au client */
  deliveryZones: string[];
  /** Frais de livraison en DA (0 = toujours gratuite) */
  deliveryFee: number;
  /** Livraison offerte à partir de ce montant en DA (0 = jamais) */
  deliveryFreeFrom: number;
}

export interface Order {
  id: string;
  name: string;
  tel: string;
  type: string;
  typeLabel: string;
  date: string;
  details: string;
  lang: Lang;
  status: OrderStatus;
  createdAt?: Date;
  /** Articles de la commande, pour le suivi du stock */
  items?: OrderItem[];
  /** Vrai une fois le stock déduit pour cette commande */
  stockDone?: boolean;
  address?: string;
  /** Commune ou quartier de livraison */
  zone?: string;
  /** Le client accepte de recevoir les offres sur WhatsApp */
  marketing?: boolean;
  /** Frais de livraison en DA */
  delivery?: number;
  /** Montant total en DA */
  total?: number;
  /** Facture créée à la confirmation */
  invoiceId?: string;
}

export interface OrderItem {
  productId: string;
  /** Pays choisi par le client */
  origin?: string;
  unit: Unit;
  grams?: number;
  qty: number;
  name_fr?: string;
  name_ar?: string;
  option_fr?: string;
  option_ar?: string;
  /** Prix du kg ou de la pièce */
  price?: number;
  /** Montant de la ligne */
  total?: number;
}

/** Quantité à retirer du stock : en kg pour la vente au kg, en pièces sinon */
export const itemQty = (i: OrderItem) => (i.unit === 'kg' ? ((i.grams ?? 0) * i.qty) / 1000 : i.qty);

export const stockUnit = (p: Product) => (p.unit === 'kg' ? 'kg' : 'pièce(s)');
export const roundStock = (n: number) => Math.round(n * 100) / 100;
/** Quantité à racheter pour revenir au maximum (0 si aucun maximum n'est défini) */
export const reorderQty = (p: Product) => (p.stockMax ? Math.max(0, roundStock(p.stockMax - (p.stock ?? 0))) : 0);
export const isOverStock = (p: Product) => !!p.trackStock && !!p.stockMax && (p.stock ?? 0) > p.stockMax;
export const isOutOfStock = (p: Product) => !!p.trackStock && (p.stock ?? 0) <= 0;
export const isLowStock = (p: Product) => !!p.trackStock && !isOutOfStock(p) && (p.stock ?? 0) <= (p.stockAlert ?? 0);

export const STATUSES: OrderStatus[] = ['nouveau', 'confirmé', 'prêt', 'en livraison', 'livré', 'récupéré', 'annulé'];

/** Même trait partout : la couleur vient du texte autour */
const lineIcon = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

export const ICONS: Record<string, string> = {
  agneau: lineIcon('M8 7C5 5 2 7 3 10c.7 2 3 2 4 .5M16 7c3-2 6 0 5 3-.7 2-3 2-4 .5M8 6h8l1 6c0 4-2 7-5 8-3-1-5-4-5-8zM10 12v.01M14 12v.01M10.5 16.5c1 .7 2 .7 3 0'),
  boeuf: lineIcon('M4 4c0 3 2 5 5 5h6c3 0 5-2 5-5M7 9v5c0 4 2 7 5 7s5-3 5-7V9M3 10c1.5 1 3 1 4 .5M21 10c-1.5 1-3 1-4 .5M10 13v.01M14 13v.01M10 18h4'),
  poulet: lineIcon('M14 4a6 6 0 0 1 4 10c-2 2-5 2-6.5 1L8 18.5a2 2 0 1 1-3-1 2 2 0 1 1 1.5-3L10 11c-1-2-.5-5 1.5-6.5A6 6 0 0 1 14 4z'),
  merguez: lineIcon('M4 8a3 3 0 0 1 3-3h10a3 3 0 0 1 0 6H7a3 3 0 0 1-3-3zM4 16a3 3 0 0 1 3-3h10a3 3 0 0 1 0 6H7a3 3 0 0 1-3-3zM2 8h2M20 8h2M2 16h2M20 16h2'),
  abats: lineIcon('M12 20.5S4 15.5 4 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5c0 6-8 11-8 11z'),
  chouwa: lineIcon('M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 1-3-1-5 1-9zM6 21h12'),
  poisson: lineIcon('M3 12c3-5 8-6 12-4 2 1 3 2.5 4 4-1 1.5-2 3-4 4-4 2-9 1-12-4zM19 12l3-3v6zM14 10.5v.01'),
  legumes: lineIcon('M14 10l-9 10c-.6.6-1.6-.3-1-1l9-10zM11 7a4 4 0 0 1 6 6zM17 7l4-4M16 6c0-2 1-3 3-4M18 8c2 0 3-1 4-3'),
};

/** Illustrations disponibles pour un rayon */
export interface ProductOrigin {
  /** Nom en français */
  country: string;
  price: number;
  /** Faux quand ce pays est retiré de la vente */
  available?: boolean;
  /** Stock de ce pays, absent tant que le stock n'est pas réparti par pays */
  stock?: number;
}

/** Pays d'un produit, avec le prix de base pour une fiche à un seul ancien pays. */
export const originsOf = (p: Pick<Product, 'origin' | 'origins' | 'price'>): ProductOrigin[] =>
  (p.origins?.length ? p.origins : p.origin ? [{ country: p.origin, price: p.price }] : []);

/** Un pays se vend s'il n'est pas retiré et que son stock, quand il est suivi, n'est pas vide. */
export const originInSale = (o: ProductOrigin) => o.available !== false && (o.stock === undefined || o.stock > 0);

/** Pays présélectionné : le local s'il est en vente, sinon le premier disponible. */
export function defaultOriginIndex(origins: ProductOrigin[]) {
  const local = origins.findIndex(o => o.country === 'Algérie' && originInSale(o));
  return local >= 0 ? local : Math.max(0, origins.findIndex(originInSale));
}

/** Pays en vente aujourd'hui */
export const availableOrigins = (p: Pick<Product, 'origin' | 'origins' | 'price'>) => originsOf(p).filter(originInSale);

/** Pays en vente parmi ces produits, sans doublon, triés par nom */
export const countriesIn = (products: Pick<Product, 'origin' | 'origins' | 'price'>[]) =>
  [...new Set(products.flatMap(p => availableOrigins(p).map(o => o.country)))].sort((a, b) => a.localeCompare(b, 'fr'));

/** Le produit a des pays, mais aucun n'est en vente */
export const noOriginLeft = (p: Pick<Product, 'origin' | 'origins' | 'price'>) => originsOf(p).length > 0 && !availableOrigins(p).length;

/** Prix affichables : ceux des pays en vente, sinon tous */
const shownPrices = (p: Pick<Product, 'origin' | 'origins' | 'price'>) =>
  (availableOrigins(p).length ? availableOrigins(p) : originsOf(p)).map(o => o.price);

/** Prix le plus bas à afficher sur une carte. */
export const lowestPrice = (p: Pick<Product, 'origin' | 'origins' | 'price'>) => {
  const prices = shownPrices(p);
  return prices.length ? Math.min(...prices) : p.price;
};

/** Plusieurs prix différents selon le pays */
export const hasPriceRange = (p: Pick<Product, 'origin' | 'origins' | 'price'>) => new Set(shownPrices(p)).size > 1;

/** « Espagne, Algérie, Brésil » */
export const originLabel = (p: Pick<Product, 'origin' | 'origins' | 'price'>) => originsOf(p).map(o => o.country).join(', ');

/** Pays proposés à la saisie ; un autre pays peut être écrit à la main. */
export const COUNTRIES: { fr: string; code: string; ar: string }[] = [
  { fr: 'Algérie', code: 'dz', ar: 'الجزائر' }, { fr: 'Inde', code: 'in', ar: 'الهند' }, { fr: 'Espagne', code: 'es', ar: 'إسبانيا' }, { fr: 'Brésil', code: 'br', ar: 'البرازيل' },
  { fr: 'Argentine', code: 'ar', ar: 'الأرجنتين' }, { fr: 'France', code: 'fr', ar: 'فرنسا' }, { fr: 'Irlande', code: 'ie', ar: 'أيرلندا' }, { fr: 'Pologne', code: 'pl', ar: 'بولندا' },
  { fr: 'Roumanie', code: 'ro', ar: 'رومانيا' }, { fr: 'Turquie', code: 'tr', ar: 'تركيا' }, { fr: 'Maroc', code: 'ma', ar: 'المغرب' }, { fr: 'Tunisie', code: 'tn', ar: 'تونس' },
  { fr: 'Mauritanie', code: 'mr', ar: 'موريتانيا' }, { fr: 'Sénégal', code: 'sn', ar: 'السنغال' }, { fr: 'Chine', code: 'cn', ar: 'الصين' }, { fr: 'Vietnam', code: 'vn', ar: 'فيتنام' },
];

/** Nom du pays dans la langue du client ; un pays écrit à la main reste tel quel. */
export const countryName = (origin: string, lang: Lang) =>
  (lang === 'ar' ? COUNTRIES.find(c => c.fr === origin)?.ar : undefined) ?? origin;

/** Drapeau du pays dans public/flags, vide pour un pays écrit à la main. */
export const countryFlag = (origin: string) => {
  const code = COUNTRIES.find(c => c.fr === origin)?.code;
  return code ? `flags/${code}.svg` : '';
};

export const ICON_NAMES: Record<string, string> = {
  agneau: 'Agneau',
  boeuf: 'Bœuf',
  poulet: 'Poulet',
  merguez: 'Merguez / préparations',
  abats: 'Abats',
  chouwa: 'Grillades',
  poisson: 'Poissons',
  legumes: 'Légumes',
};

/** Photo libre de droits : à remplacer par les vraies photos depuis l'admin */
export const photo = (id: string, w = 700) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

export const HERO_PHOTOS = [
  photo('1672787153720-e85fe802fd9f', 1800),
  photo('1595356161904-6708c97be89c', 1800),
  photo('1690983330536-3b0089d07cf9', 1800),
];

export const DEFAULT_WEIGHTS = [250, 500, 1000, 2000];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'poulet', image: photo('1672787153720-e85fe802fd9f', 900), order: 1, icon: 'poulet', name_fr: 'Poulet', name_ar: 'الدجاج' },
  { id: 'agneau', image: photo('1595356161904-6708c97be89c', 900), order: 2, icon: 'agneau', name_fr: 'Agneau', name_ar: 'لحم الغنم' },
  { id: 'boeuf', image: photo('1690983330536-3b0089d07cf9', 900), order: 3, icon: 'boeuf', name_fr: 'Bœuf', name_ar: 'لحم البقر' },
  { id: 'preparations', image: photo('1620167790054-de54f34308bb', 900), order: 4, icon: 'merguez', name_fr: 'Préparations maison', name_ar: 'مستحضرات منزلية' },
  { id: 'chouwa', image: photo('1603360946369-dc9bb6258143', 900), order: 5, icon: 'chouwa', name_fr: 'Chouwa', name_ar: 'الشواء' },
  { id: 'abats', order: 6, icon: 'abats', name_fr: 'Abats', name_ar: 'الأحشاء' },
  { id: 'poissons', image: photo('1534948216015-843149f72be3', 900), order: 7, icon: 'poisson', name_fr: 'Poissons surgelés', name_ar: 'أسماك مجمدة' },
  { id: 'legumes', image: photo('1790861286904-a5158b131c62', 900), order: 8, icon: 'legumes', name_fr: 'Légumes surgelés', name_ar: 'خضر مجمدة' },
];

type Seed = Omit<Product, 'order' | 'available' | 'unit' | 'desc_fr' | 'desc_ar'> & Partial<Product>;
const seed = (list: Seed[]): Product[] => list.map((p, i) => ({
  unit: 'kg', desc_fr: '', desc_ar: '', ...p, order: i + 1, available: true,
}));

const CUT_CHICKEN = { options_fr: ['Entier', 'Coupé en 4', 'Coupé en 8'], options_ar: ['كامل', 'مقطع إلى 4', 'مقطع إلى 8'] };
const CUT_BREAST = { options_fr: ['Entier', 'Escalopes', 'Émincé', 'En cubes'], options_ar: ['كامل', 'إسكالوب', 'شرائح', 'مكعبات'] };
const CUT_BONE = { options_fr: ['Avec os', 'Désossées'], options_ar: ['بالعظم', 'بدون عظم'] };
const CUT_MEAT = { options_fr: ['Entier', 'En tranches', 'En morceaux', 'Haché'], options_ar: ['كامل', 'شرائح', 'قطع', 'مفروم'] };
const CUT_SHEEP = { options_fr: ['Entier', 'En gros morceaux', 'En petits morceaux'], options_ar: ['كامل', 'قطع كبيرة', 'قطع صغيرة'] };
const CUT_STEAK = { options_fr: ['En tranches fines', 'En tranches épaisses'], options_ar: ['شرائح رقيقة', 'شرائح سميكة'] };

const FROZEN_FISH = [250, 500, 1000, 2000];
const FROZEN_VEG = [500, 1000, 2000];

export const DEFAULT_PRODUCTS: Product[] = seed([
  // Moutons entiers et demi-moutons : leur poids sort de la même réserve que les coupes
  { id: 'mouton-entier', image: photo('1595356161904-6708c97be89c'), category: 'agneau', price: 2600, weights: [16000, 20000, 24000], ...CUT_SHEEP,
    name_fr: 'Mouton entier', name_ar: 'خروف كامل',
    desc_fr: 'Découpé selon vos souhaits, payé au poids réel.', desc_ar: 'يقطع حسب رغبتك ويدفع حسب الوزن الفعلي.' },
  { id: 'demi-mouton', image: photo('1603048374877-b98f840ad441'), category: 'agneau', price: 2700, weights: [8000, 10000, 12000], ...CUT_SHEEP,
    name_fr: 'Demi-mouton', name_ar: 'نصف خروف',
    desc_fr: 'La moitié d\'un mouton, découpée selon vos souhaits.', desc_ar: 'نصف خروف يقطع حسب رغبتك.' },
  // Poulet
  { id: 'poulet-entier', image: photo('1672787153720-e85fe802fd9f'), category: 'poulet', price: 450, featured: true, weights: [1000, 1500, 2000, 2500], ...CUT_CHICKEN,
    name_fr: 'Poulet entier', name_ar: 'دجاجة كاملة',
    desc_fr: 'Poulet frais du jour, entier ou découpé selon votre choix.', desc_ar: 'دجاج طازج يومياً، كامل أو مقطع حسب اختيارك.' },
  { id: 'demi-poulet', image: photo('1672787153652-b3b9d92f3e8c'), category: 'poulet', price: 480, weights: [500, 750, 1000], ...CUT_CHICKEN,
    name_fr: 'Demi-poulet', name_ar: 'نصف دجاجة',
    desc_fr: 'La bonne quantité pour un petit repas.', desc_ar: 'الكمية المناسبة لوجبة صغيرة.' },
  { id: 'blanc-poulet', image: photo('1682991136736-a2b44623eeba'), category: 'poulet', price: 1100, featured: true, weights: [250, 500, 1000, 2000], ...CUT_BREAST,
    name_fr: 'Blanc de poulet', name_ar: 'صدر الدجاج',
    desc_fr: 'Viande tendre et maigre, en escalopes, émincé ou en cubes.', desc_ar: 'لحم طري وقليل الدهن، إسكالوب أو شرائح أو مكعبات.' },
  { id: 'cuisses-poulet', image: photo('1759493321741-883fbf9f433c'), category: 'poulet', price: 550, featured: true, weights: [500, 1000, 2000], ...CUT_BONE,
    name_fr: 'Cuisses de poulet', name_ar: 'أفخاذ الدجاج',
    desc_fr: 'Savoureuses au four, en sauce ou sur le grill.', desc_ar: 'لذيذة في الفرن أو بالمرق أو على الشواية.' },
  { id: 'ailes-poulet', image: photo('1604503468506-a8da13d82791'), category: 'poulet', price: 500, weights: [500, 1000, 2000],
    name_fr: 'Ailes de poulet', name_ar: 'أجنحة الدجاج',
    desc_fr: 'Idéales marinées pour la chouwa.', desc_ar: 'مثالية متبلة للشواء.' },
  { id: 'foie-gesiers', category: 'poulet', price: 600, weights: [250, 500, 1000],
    name_fr: 'Foie et gésiers', name_ar: 'كبد وقوانص',
    desc_fr: 'Frais du jour, nettoyés et prêts à cuisiner.', desc_ar: 'طازجة ومنظفة وجاهزة للطهي.' },
  // Agneau
  { id: 'gigot-agneau', image: photo('1603048297172-c92544798d5a'), category: 'agneau', price: 3000, featured: true, weights: [1000, 1500, 2000, 3000], ...CUT_MEAT,
    name_fr: "Gigot d'agneau", name_ar: 'فخذ الخروف',
    desc_fr: 'Le morceau de fête, entier ou découpé.', desc_ar: 'قطعة المناسبات، كاملة أو مقطعة.' },
  { id: 'cotelettes-agneau', image: photo('1595356161904-6708c97be89c'), category: 'agneau', price: 3200, featured: true, weights: [500, 1000, 2000],
    name_fr: "Côtelettes d'agneau", name_ar: 'ريش الغنم',
    desc_fr: 'Tendres et parfaites sur le grill.', desc_ar: 'طرية ومثالية على الشواية.' },
  { id: 'epaule-agneau', image: photo('1603048374877-b98f840ad441'), category: 'agneau', price: 2800, weights: [1000, 1500, 2000], ...CUT_MEAT,
    name_fr: "Épaule d'agneau", name_ar: 'كتف الخروف',
    desc_fr: 'Fondante pour les tajines et les plats mijotés.', desc_ar: 'طرية للطواجن والأطباق المطهوة ببطء.' },
  { id: 'agneau-couscous', image: photo('1600180786608-28d06391d25c'), category: 'agneau', price: 2600, weights: [500, 1000, 2000],
    name_fr: 'Agneau pour couscous', name_ar: 'لحم الغنم للكسكس',
    desc_fr: 'Morceaux choisis pour le couscous et la chorba.', desc_ar: 'قطع مختارة للكسكس والشوربة.' },
  { id: 'hache-agneau', image: photo('1612078894671-f11ba41d713e'), category: 'agneau', price: 3000, weights: [250, 500, 1000],
    name_fr: "Viande hachée d'agneau", name_ar: 'لحم غنم مفروم',
    desc_fr: 'Hachée à la commande.', desc_ar: 'يُفرم عند الطلب.' },
  // Bœuf
  { id: 'entrecote', image: photo('1772285466464-8ccda2c3be92'), category: 'boeuf', price: 3400, featured: true, weights: [250, 500, 1000], ...CUT_STEAK,
    name_fr: 'Entrecôte', name_ar: 'أنتريكوت',
    desc_fr: 'Persillée et pleine de goût.', desc_ar: 'لحم غني بالنكهة.' },
  { id: 'filet-boeuf', image: photo('1602470521006-59ab77068b0d'), category: 'boeuf', price: 3800, weights: [250, 500, 1000], ...CUT_STEAK,
    name_fr: 'Filet de bœuf', name_ar: 'فيليه البقر',
    desc_fr: 'Le morceau le plus tendre.', desc_ar: 'أطرى قطعة.' },
  { id: 'boeuf-couscous', image: photo('1600180786608-28d06391d25c'), category: 'boeuf', price: 2400, weights: [500, 1000, 2000],
    name_fr: 'Bœuf pour couscous et tajine', name_ar: 'لحم البقر للكسكس والطاجين',
    desc_fr: 'En morceaux, prêt à mijoter.', desc_ar: 'قطع جاهزة للطهي.' },
  { id: 'hache-boeuf', image: photo('1612078894671-f11ba41d713e'), category: 'boeuf', price: 2600, featured: true, weights: [250, 500, 1000, 2000],
    name_fr: 'Viande hachée de bœuf', name_ar: 'لحم بقر مفروم',
    desc_fr: 'Hachée à la commande.', desc_ar: 'يُفرم عند الطلب.' },
  // Préparations maison
  { id: 'merguez', image: photo('1620167790054-de54f34308bb'), category: 'preparations', price: 1800, featured: true, weights: [250, 500, 1000, 2000],
    name_fr: 'Merguez maison', name_ar: 'مرقاز منزلي',
    desc_fr: 'Préparées chaque jour avec nos épices.', desc_ar: 'تحضر يومياً بتوابلنا.' },
  { id: 'kefta', image: photo('1620167790054-de54f34308bb'), category: 'preparations', price: 2200, weights: [250, 500, 1000],
    name_fr: 'Kefta maison', name_ar: 'كفتة منزلية',
    desc_fr: 'Viande hachée assaisonnée, prête à cuire.', desc_ar: 'لحم مفروم متبل وجاهز للطهي.' },
  // Chouwa
  { id: 'brochettes-poulet', image: photo('1594266063697-304befca9629'), category: 'chouwa', price: 1400, weights: [500, 1000, 2000],
    name_fr: 'Brochettes de poulet', name_ar: 'أسياخ الدجاج',
    desc_fr: 'Marinées maison, prêtes à griller.', desc_ar: 'متبلة منزلياً وجاهزة للشواء.' },
  { id: 'brochettes-agneau', image: photo('1603360946369-dc9bb6258143'), category: 'chouwa', price: 3200, weights: [500, 1000, 2000],
    name_fr: "Brochettes d'agneau", name_ar: 'أسياخ الغنم',
    desc_fr: 'Pour vos sorties et vos fêtes.', desc_ar: 'لنزهاتكم وأعيادكم.' },
  // Abats
  { id: 'foie-agneau', category: 'abats', price: 3000, weights: [250, 500, 1000],
    name_fr: "Foie d'agneau", name_ar: 'كبدة الغنم',
    desc_fr: 'Frais, à griller ou en sauce.', desc_ar: 'طازجة، مشوية أو بالمرق.' },
  { id: 'douara', category: 'abats', price: 0, unit: 'order',
    name_fr: 'Douara', name_ar: 'الدوارة',
    desc_fr: 'Disponible sur commande.', desc_ar: 'متوفرة حسب الطلب.' },
  { id: 'bouzellouf', category: 'abats', price: 1500, unit: 'piece',
    name_fr: 'Bouzellouf', name_ar: 'بوزلوف',
    desc_fr: 'Tête de mouton nettoyée.', desc_ar: 'رأس خروف منظف.' },
  // Poissons surgelés
  { id: 'merlan', image: photo('1576330383200-2bf325cfec52'), category: 'poissons', price: 1200, weights: FROZEN_FISH,
    name_fr: 'Merlan surgelé', name_ar: 'مرلان مجمد',
    desc_fr: 'Surgelé, prêt à cuisiner.', desc_ar: 'مجمد وجاهز للطهي.' },
  { id: 'crevettes', image: photo('1565680018434-b513d5e5fd47'), category: 'poissons', price: 2500, featured: true, weights: FROZEN_FISH,
    name_fr: 'Crevettes surgelées', name_ar: 'جمبري مجمد',
    desc_fr: 'Pour vos paellas, tajines et poêlées.', desc_ar: 'للبايلا والطواجن والأطباق المقلاة.' },
  { id: 'calamar', image: photo('1762508338570-bfbbac03bec4'), category: 'poissons', price: 1800, weights: FROZEN_FISH,
    name_fr: 'Calamar surgelé', name_ar: 'كالامار مجمد',
    desc_fr: 'Entier ou en anneaux selon arrivage.', desc_ar: 'كامل أو حلقات حسب التوفر.' },
  { id: 'sardines', image: photo('1534948216015-843149f72be3'), category: 'poissons', price: 900, weights: FROZEN_FISH,
    name_fr: 'Sardines surgelées', name_ar: 'سردين مجمد',
    desc_fr: 'À griller ou en sauce.', desc_ar: 'مشوي أو بالمرق.' },
  { id: 'filet-merlu', category: 'poissons', price: 1600, weights: FROZEN_FISH,
    name_fr: 'Filet de merlu surgelé', name_ar: 'فيليه ميرلو مجمد',
    desc_fr: 'Sans arêtes, facile à cuisiner.', desc_ar: 'بدون حسك وسهل الطهي.' },
  // Légumes surgelés
  { id: 'macedoine', image: photo('1790861286904-a5158b131c62'), category: 'legumes', price: 450, weights: FROZEN_VEG,
    name_fr: 'Macédoine de légumes', name_ar: 'خليط خضر',
    desc_fr: 'Mélange surgelé prêt à cuire.', desc_ar: 'خليط مجمد جاهز للطهي.' },
  { id: 'petits-pois', image: photo('1632640107771-80c37386cfcd'), category: 'jalbana', price: 550, weights: FROZEN_VEG,
    name_fr: 'Petits pois surgelés', name_ar: 'جلبانة مجمدة',
    desc_fr: 'Jelbana surgelée, tendre et sucrée.', desc_ar: 'جلبانة مجمدة، طرية وحلوة.' },
  { id: 'pois-carottes', image: photo('1565711120607-903eb0a17e2f'), category: 'legumes', price: 500, weights: FROZEN_VEG,
    name_fr: 'Petits pois et carottes', name_ar: 'جلبانة وجزر',
    desc_fr: 'Surgelés, coupés et prêts à cuire.', desc_ar: 'مجمدة ومقطعة وجاهزة للطهي.' },
  { id: 'haricots-verts', image: photo('1567375698348-5d9d5ae99de0'), category: 'legumes', price: 500, weights: FROZEN_VEG,
    name_fr: 'Haricots verts surgelés', name_ar: 'لوبيا خضراء مجمدة',
    desc_fr: 'Équeutés et prêts à cuire.', desc_ar: 'منظفة وجاهزة للطهي.' },
  { id: 'carottes', image: photo('1781863006581-8e3eeacba61d'), category: 'legumes', price: 350, weights: FROZEN_VEG,
    name_fr: 'Carottes surgelées', name_ar: 'جزر مجمد',
    desc_fr: 'En rondelles, prêtes à cuire.', desc_ar: 'شرائح جاهزة للطهي.' },
  { id: 'epinards', category: 'legumes', price: 500, weights: FROZEN_VEG,
    name_fr: 'Épinards surgelés', name_ar: 'سبانخ مجمدة',
    desc_fr: 'Pour vos tourtes et plats en sauce.', desc_ar: 'لفطائركم وأطباقكم بالمرق.' },
]);

export const DEFAULT_OFFERS: Offer[] = [
  { id: 'o1', order: 1, available: true, featured: false, price: 9500,
    name_fr: 'Colis Famille', name_ar: 'طرد العائلة', unit_fr: '/ 4 kg', unit_ar: '/ 4 كغ',
    items_fr: ['Viande hachée', "Côtelettes d'agneau", 'Poulet entier', 'Merguez maison'],
    items_ar: ['لحم مفروم', 'ريش الغنم', 'دجاج كامل', 'مرقاز منزلي'] },
  { id: 'o2', order: 2, available: true, featured: true, price: 7500,
    name_fr: 'Plateau Chouwa', name_ar: 'صينية الشواء', unit_fr: '/ 6 pers.', unit_ar: '/ 6 أشخاص',
    items_fr: ['Brochettes marinées', 'Merguez & kefta', "Côtelettes d'agneau", "Foie d'agneau"],
    items_ar: ['أسياخ متبلة', 'مرقاز وكفتة', 'ريش الغنم', 'كبدة الغنم'] },
  { id: 'o3', order: 3, available: true, featured: false, price: 15000,
    name_fr: 'Prestige', name_ar: 'بريستيج', unit_fr: '/ 8 pers.', unit_ar: '/ 8 أشخاص',
    items_fr: ["Gigot d'agneau entier", 'Entrecôte de bœuf', 'Brochettes de poulet', 'Kefta maison'],
    items_ar: ['فخذ خروف كامل', 'أنتريكوت بقري', 'أسياخ الدجاج', 'كفتة منزلية'] },
];

export const DEFAULT_FRIDGE: FridgeItem[] = [
  { id: 'moutons', name: 'Moutons', tracked: false, kg: 0, min: 0, max: 0, kgEach: 20 },
  { id: 'vaches', name: 'Bœufs', tracked: false, kg: 0, min: 0, max: 0, kgEach: 250 },
  { id: 'poulets', name: 'Poulets', tracked: false, kg: 0, min: 0, max: 0, kgEach: 2 },
];

/** Réserve de chaque coupe du catalogue */
const DEFAULT_SOURCE: Record<string, string> = {
  'poulet-entier': 'poulets', 'demi-poulet': 'poulets', 'blanc-poulet': 'poulets', 'cuisses-poulet': 'poulets',
  'ailes-poulet': 'poulets', 'brochettes-poulet': 'poulets',
  'mouton-entier': 'moutons', 'demi-mouton': 'moutons', 'gigot-agneau': 'moutons', 'cotelettes-agneau': 'moutons',
  'epaule-agneau': 'moutons', 'agneau-couscous': 'moutons', 'hache-agneau': 'moutons', 'brochettes-agneau': 'moutons',
  'entrecote': 'vaches', 'filet-boeuf': 'vaches', 'boeuf-couscous': 'vaches', 'hache-boeuf': 'vaches',
};

/** Ajoute ou retire des kilos au stock d'un pays, sans descendre sous zéro. */
export function moveCountryStock(countries: Record<string, number> | undefined, country: string, qty: number) {
  const list = countries ?? {};
  return { ...list, [country]: Math.max(0, roundStock((list[country] ?? 0) + qty)) };
}

/** Somme des stocks par pays */
export const sumCountries = (countries: Record<string, number>) => roundStock(Object.values(countries).reduce((sum, kg) => sum + (Number(kg) || 0), 0));

/** Réserve suivie qui alimente ce produit, s'il y en a une */
export function poolOf(p: Product, fridge: FridgeItem[]) {
  if (p.unit !== 'kg' || p.source === 'none') return undefined;
  const id = p.source || DEFAULT_SOURCE[p.id];
  return fridge.find(f => f.id === id && f.tracked);
}

/** Le stock d'un produit relié est celui de sa réserve : toutes ses coupes partagent les mêmes kg. */
export const applyPools = (products: Product[], fridge: FridgeItem[]) => products.map(p => {
  const pool = poolOf(p, fridge);
  return pool
    ? {
      ...p, trackStock: true, stock: pool.kg, stockAlert: pool.min, stockMax: pool.max, restockDate: pool.restockDate,
      ...(pool.countries ? { origins: originsOf(p).map(o => ({ ...o, stock: pool.countries?.[o.country] ?? 0 })) } : {}),
    }
    : p;
});

/** Ce qui manque pour servir ces articles. Les coupes d'une même réserve s'additionnent. */
export function stockShortages(items: OrderItem[], products: Product[], fridge: FridgeItem[]) {
  const needs = new Map<string, { name: string; unit: string; have: number; need: number }>();
  for (const item of items) {
    const product = products.find(p => p.id === item.productId);
    if (!product) continue;
    const pool = poolOf(product, fridge);
    if (!pool && !product.trackStock) continue;
    const own = originsOf(product).find(o => o.country === item.origin);
    const perCountry = item.origin && (pool ? pool.countries : own?.stock !== undefined);
    const key = `${pool ? `pool-${pool.id}` : product.id}|${perCountry ? item.origin : ''}`;
    const name = pool ? pool.name : product.name_fr;
    const line = needs.get(key) ?? {
      name: perCountry ? `${name} (${item.origin})` : name,
      unit: pool ? 'kg' : stockUnit(product),
      have: perCountry ? (pool ? pool.countries?.[item.origin!] ?? 0 : own?.stock ?? 0) : pool ? pool.kg : product.stock ?? 0,
      need: 0,
    };
    needs.set(key, { ...line, need: roundStock(line.need + itemQty(item)) });
  }
  return [...needs.values()].filter(l => l.need > l.have);
}

/** Produits qui gardent leur propre stock */
export const ownStock = (products: Product[], fridge: FridgeItem[]) => products.filter(p => !poolOf(p, fridge));

/** Lit le frigo enregistré ; l'ancien format comptait des bêtes, pas des kg. */
export const readFridge = (list: (FridgeItem & { count?: number })[]): FridgeItem[] =>
  list.map(({ count, ...f }) => ({ ...f, tracked: !!f.tracked, kg: f.kg ?? (count ?? 0) * f.kgEach }));

/** Vrai pour un frigo de produits (surgelés…), faux pour une réserve en kg */
export const isCabinet = (f: FridgeItem) => !!f.rayons?.length;

/** Équivalent en bêtes d'une quantité en kg */
export const animals = (f: FridgeItem, kg = f.kg) => (f.kgEach ? roundStock(kg / f.kgEach) : 0);

export const DEFAULT_SETTINGS: Settings = {
  name_fr: 'Boucherie Hallem',
  name_ar: 'جزارة حلّام',
  company: 'SARL Deligne',
  nif: '',
  nis: '',
  rc: '',
  ai: '',
  vatRate: 0,
  stampRate: 0,
  address_fr: 'Aïn El Berd, Sidi Bel Abbès — Algérie',
  address_ar: 'عين البرد، سيدي بلعباس — الجزائر',
  mapLink: 'https://maps.app.goo.gl/ZFvfvTezb546B2F8A',
  phone: '0X XX XX XX XX',
  whatsapp: '213000000000',
  deliveryEnabled: true,
  deliveryZones: ['Aïn El Berd', 'Sidi Bel Abbès'],
  deliveryFee: 200,
  deliveryFreeFrom: 5000,
};

/** Frais de livraison pour un panier : gratuits selon le paramétrage de l'admin. */
export function deliveryCost(s: Settings, subtotal: number) {
  return s.deliveryFreeFrom > 0 && subtotal >= s.deliveryFreeFrom ? 0 : s.deliveryFee;
}

export const formatNumber = (n: number) =>
  Number(n || 0).toLocaleString('fr-FR').replace(/[  ]/g, ' ');

export const byOrder = (a: { order?: number }, b: { order?: number }) => (a.order ?? 99) - (b.order ?? 99);

/** 250 → « 250 g », 1500 → « 1,5 kg » (unités traduites par l'appelant) */
export function formatWeight(grams: number, gLabel: string, kgLabel: string) {
  return grams >= 1000
    ? `${String(grams / 1000).replace('.', ',')} ${kgLabel}`
    : `${grams} ${gLabel}`;
}

/** Référence courte d'une commande, lisible au téléphone */
export const orderRef = (id: string) => id.slice(-6).toUpperCase();
