import { FridgeItem, Product, applyPools, isCabinet, poolOf, roundStock, stockUnit } from './data';

/** Une bête de l'arrivage : son poids, son pays et son prix d'achat au kg */
export interface BeastLine {
  kg: number;
  origin: string;
  /** Prix d'achat en DA / kg */
  price?: number;
}

/** Ce qui reçoit l'arrivage : une réserve du frigo ou un produit suivi seul */
export interface LotTarget {
  kind: 'fridge' | 'product';
  id: string;
  name: string;
  unit: string;
  /** Rayon du produit, pour ranger la liste */
  group?: string;
}

/** Arrivage de marchandise, identifié par son matricule */
export interface Lot {
  id: string;
  matricule: string;
  target: LotTarget;
  qty: number;
  /** AAAA-MM-JJ */
  arrivalDate: string;
  supplierName: string;
  supplierRef: string;
  note: string;
  /** Pays d'origine de cet arrivage */
  origin?: string;
  /** Nombre de bêtes entières reçues (réserve du frigo) */
  beasts?: number;
  /** Poids de chaque bête, quand on les a pesées une à une (ancien format) */
  weights?: number[];
  /** Une ligne par bête reçue */
  lines?: BeastLine[];
  /** Prix d'achat en DA / kg (produit reçu au poids) */
  price?: number;
  /** Coût d'achat total en DA */
  cost?: number;
  /** Un arrivage annulé reste dans l'historique et garde son matricule */
  cancelled?: boolean;
}

export type LotInput = Omit<Lot, 'id' | 'matricule' | 'cancelled'>;

/** Ce que l'arrivage ajoute à chaque pays : les bêtes d'un même pays sont regroupées. */
export function lotParts(lot: Pick<Lot, 'qty' | 'origin' | 'beasts' | 'lines'>) {
  if (!lot.lines?.length) return [{ origin: lot.origin, qty: lot.qty, beasts: lot.beasts ?? 0 }];
  const parts = new Map<string, { origin: string; qty: number; beasts: number }>();
  for (const l of lot.lines) {
    const p = parts.get(l.origin) ?? { origin: l.origin, qty: 0, beasts: 0 };
    parts.set(l.origin, { ...p, qty: roundStock(p.qty + l.kg), beasts: p.beasts + 1 });
  }
  return [...parts.values()];
}

/** Coût d'achat des bêtes dont le prix est connu */
export const linesCost = (lines: BeastLine[]) => Math.round(lines.reduce((sum, l) => sum + l.kg * (l.price ?? 0), 0));

/** Pays de l'arrivage, sans doublon : « Algérie, Espagne » */
export const lotOrigins = (lot: Pick<Lot, 'origin' | 'lines'>) =>
  lot.lines?.length ? [...new Set(lot.lines.map(l => l.origin))].join(', ') : lot.origin ?? '';

/** « 21 23,5 22 » ou « 21; 23.5; 22 » → [21, 23.5, 22] : une virgule collée entre deux chiffres est une décimale. */
export function parseWeights(text: string) {
  return text.replace(/,\s+/g, ' ').split(/[\s;+]+/).map(t => Number(t.replace(',', '.'))).filter(n => n > 0);
}

export const lotNumber = (year: number, n: number) => `LOT-${year}-${String(n).padStart(4, '0')}`;

/**
 * Les réserves (bêtes entières) d'abord, puis tous les produits qui ont leur propre stock :
 * poissons, surgelés, coupes… Un premier arrivage met le produit en suivi de stock.
 * Le mouton entier et le demi sortent des bêtes : on reçoit les bêtes, pas le produit.
 */
export function lotTargets(products: Product[], fridge: FridgeItem[]): LotTarget[] {
  return [
    ...fridge.filter(f => !isCabinet(f)).map(f => ({ kind: 'fridge' as const, id: f.id, name: f.name, unit: 'kg' })),
    ...applyPools(products, fridge).filter(p => !poolOf(p, fridge) && p.unit !== 'order' && !p.custom)
      .map(p => ({ kind: 'product' as const, id: p.id, name: p.name_fr, unit: stockUnit(p), ...(p.category ? { group: p.category } : {}) })),
  ];
}

/** Fournisseurs déjà utilisés, sans doublon, pour les proposer à la saisie. */
export function supplierNames(lots: Lot[]) {
  const names = new Map<string, string>();
  for (const l of lots) {
    const name = l.supplierName.trim();
    if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

export function searchLots(lots: Lot[], text: string) {
  const q = text.trim().toLowerCase();
  if (!q) return lots;
  return lots.filter(l =>
    [l.matricule, l.supplierName, l.supplierRef, l.target.name, l.arrivalDate, lotOrigins(l)].some(v => v.toLowerCase().includes(q)));
}
