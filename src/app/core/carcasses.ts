import { FridgeItem, roundStock } from './data';
import { Lot } from './lots';

/** Une bête entière (ou une demi) suspendue au frigo, reconnue par son arrivage et son numéro */
export interface Carcass {
  id: string;
  kg: number;
  origin?: string;
  /** Matricule de l'arrivage */
  lot?: string;
  /** Numéro de la bête dans l'arrivage */
  n?: number;
  /** Prix d'achat en DA / kg */
  price?: number;
  /** Date d'arrivée AAAA-MM-JJ */
  date?: string;
  /** Il ne reste que la moitié de cette bête */
  half?: boolean;
  /** Reste d'une découpe, gardé au frigo pour être redécoupé ; ce n'est plus une bête entière */
  part?: boolean;
}

export const shareOf = (c: Carcass) => (c.part ? 0 : c.half ? 0.5 : 1);

/** Firestore refuse les champs vides : on ne garde que ceux qui ont une valeur. */
export function cleanCarcass(c: Carcass): Carcass {
  return Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined && v !== null && v !== '')) as unknown as Carcass;
}

/** Nom affiché : « N° 1 · LOT-2026-0001 » ou « Bête 2 » */
export const carcassLabel = (c: Carcass, i: number) =>
  `${c.lot ? `N° ${c.n ?? i + 1} · ${c.lot}` : `Bête ${i + 1}`}${c.part ? ' · reste' : ''}`;

/** Carcasses génériques au poids moyen, pour un frigo enregistré avant le suivi bête par bête */
function generic(f: FridgeItem): Carcass[] {
  const groups: [string | undefined, number][] = f.wholeBy && Object.keys(f.wholeBy).length
    ? Object.entries(f.wholeBy) : [[undefined, f.whole ?? 0]];
  const out: Carcass[] = [];
  for (const [origin, n] of groups) {
    if (!(n > 0)) continue;
    const kg = origin && f.countries ? f.countries[origin] ?? 0 : f.kg;
    const each = roundStock(kg / n);
    for (let i = 0; i < Math.floor(n); i++) out.push(cleanCarcass({ id: `${f.id}-${origin ?? 'x'}-${i + 1}`, kg: each, origin }));
    if (n % 1 >= 0.5) out.push(cleanCarcass({ id: `${f.id}-${origin ?? 'x'}-demi`, kg: roundStock(each / 2), origin, half: true }));
  }
  return out;
}

/** Les carcasses d'un frigo : la liste enregistrée, sinon des carcasses au poids moyen */
export const carcassesOf = (f: FridgeItem): Carcass[] => f.carcasses ?? generic(f);

/**
 * Pour un frigo sans liste, retrouve les vraies bêtes dans les arrivages récents (poids, n°, prix),
 * pays par pays, autant qu'il reste de bêtes entières.
 */
export function rebuildCarcasses(f: FridgeItem, lots: Lot[]): Carcass[] {
  if (f.carcasses) return f.carcasses;
  const fallback = generic(f);
  const counts = new Map<string, number>();
  for (const c of fallback) counts.set(c.origin ?? '', (counts.get(c.origin ?? '') ?? 0) + shareOf(c));
  const mine = lots.filter(l => !l.cancelled && l.target.kind === 'fridge' && l.target.id === f.id && l.lines?.length)
    .sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate));
  const out: Carcass[] = [];
  for (const [origin, n] of counts) {
    const lines = mine.flatMap(l => l.lines!.map((b, i) => ({ b, i, l }))).filter(x => !origin || x.b.origin === origin);
    const full = Math.floor(n);
    const found = lines.slice(0, full).map(({ b, i, l }) => cleanCarcass({
      id: `${l.matricule}-${i + 1}`, kg: b.kg, origin: b.origin, lot: l.matricule, n: i + 1, price: b.price, date: l.arrivalDate,
    }));
    out.push(...found, ...fallback.filter(c => (c.origin ?? '') === origin).slice(found.length));
  }
  return out.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
}

/** Recalcule les bêtes, les kilos et les pays du frigo à partir de ses carcasses. */
export function withCarcasses(f: FridgeItem, list: Carcass[]): FridgeItem {
  const wholeBy: Record<string, number> = Object.fromEntries(Object.keys(f.wholeBy ?? f.countries ?? {}).map(k => [k, 0]));
  const countries: Record<string, number> = Object.fromEntries(Object.keys(f.countries ?? {}).map(k => [k, 0]));
  for (const c of list) {
    if (!c.origin) continue;
    wholeBy[c.origin] = roundStock((wholeBy[c.origin] ?? 0) + shareOf(c));
    countries[c.origin] = roundStock((countries[c.origin] ?? 0) + c.kg);
  }
  const byCountry = Object.keys(countries).length > 0;
  return {
    ...f, carcasses: list.map(({ price, ...c }) => cleanCarcass(c)),
    whole: roundStock(list.reduce((sum, c) => sum + shareOf(c), 0)),
    kg: roundStock(list.reduce((sum, c) => sum + c.kg, 0)),
    ...(byCountry ? { countries, wholeBy } : {}),
  };
}

const fits = (c: Carcass, origin?: string) => !c.part && (!origin || !c.origin || c.origin === origin);

/**
 * Vente d'une bête entière ou d'une demi : on prend la carcasse dont le poids est le plus proche
 * de celui commandé. Une demi prend d'abord une demi-carcasse déjà entamée.
 * Rend null s'il n'y a pas de carcasse qui convient.
 */
export function sellCarcass(list: Carcass[], share: 0.5 | 1, origin?: string, kg = 0): Carcass[] | null {
  if (share === 0.5) {
    const half = list.find(c => c.half && fits(c, origin));
    if (half) return list.filter(c => c !== half);
  }
  const target = share === 0.5 ? kg * 2 : kg;
  const full = list.filter(c => !c.half && fits(c, origin))
    .sort((a, b) => Math.abs(a.kg - target) - Math.abs(b.kg - target))[0];
  if (!full) return null;
  return share === 1 ? list.filter(c => c !== full) : list.map(c => (c === full ? { ...c, half: true, kg: roundStock(c.kg / 2) } : c));
}

/** Retire des bêtes dans l'ordre d'arrivée (les plus anciennes d'abord) ; null s'il n'y en a pas assez. */
export function removeOldest(list: Carcass[], beasts: number, origin?: string): Carcass[] | null {
  let next = [...list];
  let left = roundStock(beasts);
  while (left >= 1) {
    const c = next.find(x => !x.half && fits(x, origin));
    if (!c) return null;
    next = next.filter(x => x !== c);
    left = roundStock(left - 1);
  }
  if (left > 0) {
    const out = sellCarcass(next, 0.5, origin);
    if (!out) return null;
    next = out;
  }
  return next;
}
