import { Category, FridgeItem, Order, Product, applyPools, carcassOf, isCabinet, isLowStock, isOutOfStock, itemQty, reserveOf, roundStock, wholeLeft } from './data';
import { Lot, LotTarget } from './lots';

/** Pourquoi la marchandise sort du stock sans être vendue */
export type ExitReason = 'perte' | 'perime' | 'decoupe' | 'personnel' | 'retour' | 'don' | 'inventaire';

export const EXIT_REASONS: { id: ExitReason; label: string; hint: string }[] = [
  { id: 'perte', label: 'Perte ou abîmé', hint: 'Viande tombée, mal conservée, couleur changée…' },
  { id: 'perime', label: 'Date dépassée', hint: 'Produit qui ne peut plus être vendu.' },
  { id: 'decoupe', label: 'Os et déchets de découpe', hint: 'Ce qui part à la découpe d\'une bête.' },
  { id: 'personnel', label: 'Repas du personnel', hint: 'Viande prise pour l\'équipe.' },
  { id: 'retour', label: 'Retour au fournisseur', hint: 'Marchandise rendue, refusée à la livraison…' },
  { id: 'don', label: 'Don', hint: 'Viande donnée (sadaqa, association…).' },
  { id: 'inventaire', label: 'Correction d\'inventaire', hint: 'Le comptage trouve moins que l\'écran.' },
];

export const exitLabel = (r: ExitReason) => EXIT_REASONS.find(x => x.id === r)?.label ?? r;

/** Sortie de stock sans vente, rangée avec les arrivages (même registre, même matricule annuel) */
export interface StockExit {
  id: string;
  kind: 'sortie';
  matricule: string;
  target: LotTarget;
  qty: number;
  /** AAAA-MM-JJ */
  date: string;
  reason: ExitReason;
  /** Pays d'origine du stock retiré */
  origin?: string;
  /** Matricule de l'arrivage concerné, pour la traçabilité */
  lot?: string;
  /** Bêtes entières retirées (réserve du frigo) */
  beasts?: number;
  note: string;
  cancelled?: boolean;
}

export type ExitInput = Omit<StockExit, 'id' | 'kind' | 'matricule' | 'cancelled'>;

export const exitNumber = (year: number, n: number) => `SOR-${year}-${String(n).padStart(4, '0')}`;

/** Découpe de bêtes entières en coupes, rangée elle aussi dans le registre */
export interface CutRecord {
  id: string;
  kind: 'decoupe';
  matricule: string;
  reserve: { id: string; name: string };
  /** Pays des bêtes découpées */
  origin?: string;
  /** Bêtes entières découpées (0,5 = une demi-bête) */
  beasts: number;
  /** Poids des carcasses découpées */
  kg: number;
  /** Ce qui en sort, coupe par coupe */
  cuts: { id: string; name: string; kg: number }[];
  /** Os et déchets : poids des carcasses moins les coupes */
  waste: number;
  /** AAAA-MM-JJ */
  date: string;
  note: string;
  cancelled?: boolean;
}

export type CutInput = Omit<CutRecord, 'id' | 'kind' | 'matricule' | 'cancelled' | 'waste'>;

export const cutNumber = (year: number, n: number) => `DEC-${year}-${String(n).padStart(4, '0')}`;

/** Os et déchets d'une découpe */
export const cutWaste = (kg: number, cuts: { kg: number }[]) => roundStock(kg - cuts.reduce((sum, c) => sum + (Number(c.kg) || 0), 0));

type RegisterDoc = Lot | StockExit | CutRecord;

/** Le registre mélange arrivages, découpes et sorties : on les sépare à la lecture. */
export function splitRegister(docs: RegisterDoc[]) {
  const kind = (d: RegisterDoc) => (d as { kind?: string }).kind;
  const exits = docs.filter((d): d is StockExit => kind(d) === 'sortie');
  const cuts = docs.filter((d): d is CutRecord => kind(d) === 'decoupe');
  const lots = docs.filter((d): d is Lot => !kind(d));
  return { lots, exits, cuts };
}

/** Coupes d'une réserve : les produits de cet animal qui ne se vendent pas en bête entière */
export const cutsOf = (reserve: FridgeItem, products: Product[]) =>
  products.filter(p => reserveOf(p, [reserve])?.id === reserve.id && !carcassOf(p));

/** Pays où il reste des bêtes entières à découper */
export const reserveCountries = (f: FridgeItem) => Object.keys(f.wholeBy ?? f.countries ?? {});

/** Poids moyen d'une bête entière restante, pour un pays quand il est séparé */
export function beastWeight(f: FridgeItem, country?: string) {
  const beasts = wholeLeft(f, country);
  const kg = country && f.countries ? f.countries[country] ?? 0 : f.kg;
  return beasts > 0 ? roundStock(kg / beasts) : f.kgEach || 0;
}

/** Quantité disponible là où l'on veut retirer (réserve, pays, ou produit). */
export function availableQty(target: LotTarget, fridge: FridgeItem[], products: Product[], origin?: string) {
  if (target.kind === 'fridge') {
    const f = fridge.find(x => x.id === target.id);
    if (!f) return 0;
    return origin && f.countries ? f.countries[origin] ?? 0 : f.kg;
  }
  const p = products.find(x => x.id === target.id);
  if (!p) return 0;
  const o = origin ? p.origins?.find(x => x.country === origin) : undefined;
  return o?.stock ?? p.stock ?? 0;
}

/** Pays proposés pour la sortie : ceux qui ont un stock séparé. */
export function targetCountries(target: LotTarget | null, fridge: FridgeItem[], products: Product[]) {
  if (!target) return [];
  if (target.kind === 'fridge') return Object.keys(fridge.find(f => f.id === target.id)?.countries ?? {});
  return (products.find(p => p.id === target.id)?.origins ?? []).filter(o => o.stock !== undefined).map(o => o.country);
}

export function searchExits(exits: StockExit[], text: string) {
  const q = text.trim().toLowerCase();
  if (!q) return exits;
  return exits.filter(e => [e.matricule, e.target.name, e.lot ?? '', e.note, exitLabel(e.reason), e.date].some(v => v.toLowerCase().includes(q)));
}

const shiftDay = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Quantités en kg et en pièces, sans les mélanger */
export interface Amount { kg: number; pieces: number }
const add = (a: Amount, qty: number, unit: string) => (unit === 'kg' ? { ...a, kg: roundStock(a.kg + qty) } : { ...a, pieces: roundStock(a.pieces + qty) });
const zero = (): Amount => ({ kg: 0, pieces: 0 });

/** Les chiffres de chaque étape, sur les derniers jours (aujourd'hui compris). */
export function chainSummary(input: {
  lots: Lot[]; exits: StockExit[]; cuts?: CutRecord[]; fridge: FridgeItem[]; products: Product[]; orders: Order[]; today: string; days?: number;
}) {
  const from = shiftDay(input.today, -((input.days ?? 7) - 1));
  const inRange = (d: string) => d >= from && d <= input.today;
  const lots = input.lots.filter(l => !l.cancelled && inRange(l.arrivalDate));
  const exits = input.exits.filter(e => !e.cancelled && inRange(e.date));
  const reserves = input.fridge.filter(f => !isCabinet(f));
  const shelves = shelfLines(input.products, input.fridge);
  const sold = input.orders.filter(o => o.stockDone && o.status !== 'annulé' && inRange(o.date))
    .flatMap(o => o.items ?? []).reduce((a, i) => add(a, itemQty(i), i.unit === 'kg' ? 'kg' : 'pièce'), zero());
  const byReason = new Map<ExitReason, Amount>();
  for (const e of exits) byReason.set(e.reason, add(byReason.get(e.reason) ?? zero(), e.qty, e.target.unit));
  const cuts = (input.cuts ?? []).filter(c => !c.cancelled && inRange(c.date));
  // Les os d'une découpe sont une sortie sans vente, comptée avec les autres
  const waste = roundStock(cuts.reduce((sum, c) => sum + Math.max(0, c.waste), 0));
  if (waste) byReason.set('decoupe', add(byReason.get('decoupe') ?? zero(), waste, 'kg'));
  const exitTotal = [...byReason.values()].reduce((a, r) => ({ kg: roundStock(a.kg + r.kg), pieces: roundStock(a.pieces + r.pieces) }), zero());
  return {
    from,
    arrivals: { count: lots.length, ...lots.reduce((a, l) => add(a, l.qty, l.target.unit), zero()) },
    fridge: {
      beasts: roundStock(reserves.reduce((sum, f) => sum + (f.whole ?? 0), 0)),
      kg: roundStock(reserves.reduce((sum, f) => sum + f.kg, 0)),
      alerts: reserves.filter(f => f.tracked && (f.kg <= 0 || (f.min && f.kg <= f.min))).length,
      count: reserves.length,
    },
    shelves: {
      onShelf: shelves.filter(s => s.state === 'vitrine').length,
      toFill: shelves.filter(s => s.state === 'remplir' || s.state === 'vide').length,
      off: shelves.filter(s => s.state === 'retire').length,
    },
    cuts: {
      count: cuts.length,
      beasts: roundStock(cuts.reduce((sum, c) => sum + c.beasts, 0)),
      kg: roundStock(cuts.reduce((sum, c) => sum + c.kg - Math.max(0, c.waste), 0)),
    },
    sold,
    exits: { count: exits.length + cuts.filter(c => c.waste > 0).length, ...exitTotal, byReason: [...byReason].map(([reason, amount]) => ({ reason, ...amount })) },
  };
}

/** État d'un produit dans le rayon de la boutique (et sur le site) */
export type ShelfState = 'vitrine' | 'remplir' | 'vide' | 'retire';

export const SHELF_LABELS: Record<ShelfState, string> = {
  vitrine: 'En rayon', remplir: 'À remplir', vide: 'Rayon vide', retire: 'Retiré du rayon',
};

export interface ShelfLine {
  product: Product;
  state: ShelfState;
  /** Stock vu par le site (celui de la réserve pour une coupe reliée) */
  qty: number | null;
  unit: string;
}

const SHELF_RANK: Record<ShelfState, number> = { vide: 0, remplir: 1, vitrine: 2, retire: 3 };

/** Un produit est « en rayon » quand il est visible sur le site et qu'il reste du stock. */
export function shelfLines(products: Product[], fridge: FridgeItem[], rayon = ''): ShelfLine[] {
  return applyPools(products, fridge)
    .filter(p => !rayon || p.category === rayon)
    .map((p): ShelfLine => ({
      product: p,
      state: !p.available ? 'retire' : isOutOfStock(p) ? 'vide' : isLowStock(p) ? 'remplir' : 'vitrine',
      qty: p.trackStock ? roundStock(p.stock ?? 0) : null,
      unit: p.unit === 'kg' ? 'kg' : 'pièce(s)',
    }))
    .sort((a, b) => SHELF_RANK[a.state] - SHELF_RANK[b.state] || (a.product.order ?? 0) - (b.product.order ?? 0));
}

/** Nombre de produits à remplir par rayon, pour les onglets */
export function shelfAlerts(products: Product[], fridge: FridgeItem[], categories: Category[]) {
  const lines = shelfLines(products, fridge);
  return categories.map(c => ({
    category: c,
    total: lines.filter(l => l.product.category === c.id).length,
    alerts: lines.filter(l => l.product.category === c.id && (l.state === 'vide' || l.state === 'remplir')).length,
  }));
}
