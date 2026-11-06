import { FridgeItem, Product, isCabinet, poolOf, stockUnit } from './data';

/** Ce qui reçoit l'arrivage : une réserve du frigo ou un produit suivi seul */
export interface LotTarget {
  kind: 'fridge' | 'product';
  id: string;
  name: string;
  unit: string;
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
  /** Un arrivage annulé reste dans l'historique et garde son matricule */
  cancelled?: boolean;
}

export type LotInput = Omit<Lot, 'id' | 'matricule' | 'cancelled'>;

export const lotNumber = (year: number, n: number) => `LOT-${year}-${String(n).padStart(4, '0')}`;

/** Les réserves d'abord, puis les produits dont le stock ne dépend pas d'une réserve. */
export function lotTargets(products: Product[], fridge: FridgeItem[]): LotTarget[] {
  return [
    ...fridge.filter(f => !isCabinet(f)).map(f => ({ kind: 'fridge' as const, id: f.id, name: f.name, unit: 'kg' })),
    ...products.filter(p => p.trackStock && !poolOf(p, fridge))
      .map(p => ({ kind: 'product' as const, id: p.id, name: p.name_fr, unit: stockUnit(p) })),
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
    [l.matricule, l.supplierName, l.supplierRef, l.target.name, l.arrivalDate].some(v => v.toLowerCase().includes(q)));
}
