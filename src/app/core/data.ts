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

export interface Hours {
  fr: string;
  ar: string;
  h: string;
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
  phone: string;
  whatsapp: string;
  hours: Hours[];
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

export const ICONS: Record<string, string> = {
  agneau: `<svg viewBox="0 0 100 100"><g fill="none" stroke="#7a1f2b" stroke-width="5" stroke-linecap="round"><path d="M38,32 c-8,-12 -28,-10 -29,5 c-1,13 15,18 20,8 c3,-6 -3,-11 -8,-8"/><path d="M62,32 c8,-12 28,-10 29,5 c1,13 -15,18 -20,8 c-3,-6 3,-11 8,-8"/></g><path d="M38,30 q12,-7 24,0 l4,24 q-2,22 -16,30 q-14,-8 -16,-30 z" fill="#fff" stroke="#7a1f2b" stroke-width="3"/><circle cx="44" cy="48" r="3" fill="#7a1f2b"/><circle cx="56" cy="48" r="3" fill="#7a1f2b"/></svg>`,
  boeuf: `<svg viewBox="0 0 100 100"><path d="M18,52 c0,-22 22,-34 44,-30 c20,4 26,22 20,38 c-6,16 -26,22 -44,18 c-14,-3 -20,-12 -20,-26z" fill="#b8323f" stroke="#fff" stroke-width="5"/><path d="M34,48 q14,-10 30,-2 M30,60 q18,-6 36,4" stroke="#e8a3a3" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="66" cy="38" r="7" fill="#fff"/></svg>`,
  poulet: `<svg viewBox="0 0 100 100"><path d="M60,20 c16,0 24,14 20,28 c-4,14 -18,20 -30,16 l-14,14 a6,6 0 1,1 -8,-8 l14,-14 c-6,-12 0,-36 18,-36z" fill="#d98a3a" stroke="#7a1f2b" stroke-width="3"/><circle cx="24" cy="80" r="6" fill="#fff" stroke="#7a1f2b" stroke-width="3"/><circle cx="18" cy="74" r="6" fill="#fff" stroke="#7a1f2b" stroke-width="3"/><path d="M58,32 q10,0 14,10" stroke="#f3c48a" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
  merguez: `<svg viewBox="0 0 100 100"><g stroke="#7a1f2b" stroke-width="3"><rect x="14" y="26" width="72" height="14" rx="7" fill="#a8323a"/><rect x="14" y="46" width="72" height="14" rx="7" fill="#b8423f"/><rect x="14" y="66" width="72" height="14" rx="7" fill="#a8323a"/></g><g fill="#7a1f2b"><circle cx="10" cy="33" r="3"/><circle cx="90" cy="53" r="3"/><circle cx="10" cy="73" r="3"/></g></svg>`,
  abats: `<svg viewBox="0 0 100 100"><path d="M20,50 c0,-18 18,-28 34,-26 c18,2 28,16 26,30 c-2,16 -20,24 -36,22 c-14,-2 -24,-12 -24,-26z" fill="#6b1e26" stroke="#3a0e15" stroke-width="3"/><path d="M50,24 q-4,26 4,52" stroke="#3a0e15" stroke-width="3" fill="none"/><path d="M32,42 q6,-6 12,-4" stroke="#a5525a" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  poisson: `<svg viewBox="0 0 100 100"><path d="M8,50 c16,-24 46,-28 66,-8 l18,-14 v44 l-18,-14 c-20,20 -50,16 -66,-8z" fill="#7fa8bd" stroke="#2f5568" stroke-width="3"/><circle cx="26" cy="46" r="4" fill="#2f5568"/><path d="M44,36 q8,14 0,28" stroke="#2f5568" stroke-width="3" fill="none"/></svg>`,
  legumes: `<svg viewBox="0 0 100 100"><path d="M30,60 c-8,-30 30,-46 50,-40 c6,20 -10,58 -40,50z" fill="#5f9e4a" stroke="#2f5d24" stroke-width="3"/><g fill="#a7d36b" stroke="#2f5d24" stroke-width="2"><circle cx="46" cy="52" r="7"/><circle cx="58" cy="42" r="7"/><circle cx="68" cy="31" r="6"/></g><path d="M30,60 l-14,20" stroke="#2f5d24" stroke-width="4" stroke-linecap="round"/></svg>`,
  chouwa: `<svg viewBox="0 0 100 100"><path d="M50,10 c6,14 22,22 22,44 a22,22 0 0,1 -44,0 c0,-12 8,-18 10,-28 c4,8 8,10 10,10 c0,-10 0,-18 2,-26z" fill="#e0662b"/><path d="M50,46 c4,8 12,12 12,22 a12,12 0 0,1 -24,0 c0,-8 6,-10 8,-16 c2,4 4,4 4,4z" fill="#f3c04a"/><path d="M12,88 l76,-18" stroke="#7a1f2b" stroke-width="4" stroke-linecap="round"/></svg>`,
};

/** Illustrations disponibles pour un rayon */
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
    ? { ...p, trackStock: true, stock: pool.kg, stockAlert: pool.min, stockMax: pool.max, restockDate: pool.restockDate }
    : p;
});

/** Produits qui gardent leur propre stock */
export const ownStock = (products: Product[], fridge: FridgeItem[]) => products.filter(p => !poolOf(p, fridge));

/** Lit le frigo enregistré ; l'ancien format comptait des bêtes, pas des kg. */
export const readFridge = (list: (FridgeItem & { count?: number })[]): FridgeItem[] =>
  list.map(({ count, ...f }) => ({ ...f, tracked: !!f.tracked, kg: f.kg ?? (count ?? 0) * f.kgEach }));

/** Équivalent en bêtes d'une quantité en kg */
export const animals = (f: FridgeItem, kg = f.kg) => (f.kgEach ? roundStock(kg / f.kgEach) : 0);

export const DEFAULT_SETTINGS: Settings = {
  name_fr: 'Boucherie Hallem',
  name_ar: 'جزارة حلام',
  company: 'SARL Deligne',
  nif: '',
  nis: '',
  rc: '',
  ai: '',
  vatRate: 0,
  stampRate: 0,
  address_fr: 'Aïn El Berd, Sidi Bel Abbès — Algérie',
  address_ar: 'عين البرد، سيدي بلعباس — الجزائر',
  phone: '0X XX XX XX XX',
  whatsapp: '213000000000',
  hours: [
    { fr: 'Samedi – Jeudi', ar: 'السبت – الخميس', h: '7h00 – 20h00' },
    { fr: 'Vendredi', ar: 'الجمعة', h: '7h00 – 12h00' },
  ],
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
