import { Order, Product, formatWeight, orderRef } from '../core/data';

export interface Label {
  name_fr: string;
  name_ar: string;
  /** Découpe */
  detail: string;
  weight: string;
  /** Prix du kg, 0 si non affiché */
  priceKg: number;
  /** Montant du paquet, 0 si non affiché */
  amount: number;
  ref: string;
  client: string;
  /** Ticket du matin : seulement le nom et les dates, en grand */
  simple?: boolean;
}

/** Tickets à coller sur la viande de la vitrine : aucun lien avec une commande. */
export function morningLabels(products: Product[], counts: Record<string, number>): Label[] {
  return products.flatMap(p => {
    const label: Label = {
      name_fr: p.name_fr, name_ar: p.name_ar, detail: '', weight: '', priceKg: 0, amount: 0, ref: '', client: '', simple: true,
    };
    return Array.from({ length: Math.max(0, Math.floor(counts[p.id] ?? 0)) }, () => label);
  });
}

const weightText = (grams: number) => formatWeight(Math.round(grams), 'g', 'kg');

/** Une étiquette par paquet : 2 × 500 g donnent 2 étiquettes de 500 g. */
export function labelsFromOrder(o: Order): Label[] {
  return (o.items ?? []).filter(i => i.name_fr).flatMap(i => {
    const label: Label = {
      name_fr: i.name_fr ?? '', name_ar: i.name_ar ?? '', detail: i.option_fr ?? '',
      weight: i.grams ? weightText(i.grams) : '',
      priceKg: i.unit === 'kg' ? (i.price ?? 0) : 0,
      amount: i.qty ? Math.round((i.total ?? 0) / i.qty) : 0,
      ref: orderRef(o.id), client: o.name,
    };
    return Array.from({ length: i.qty }, () => label);
  });
}

/** Étiquette saisie à la main, pour la vitrine ou le frigo. */
export function manualLabel(p: Product, grams: number): Label {
  return {
    name_fr: p.name_fr, name_ar: p.name_ar, detail: '', weight: grams ? weightText(grams) : '',
    priceKg: p.unit === 'kg' ? p.price : 0,
    amount: p.unit === 'kg' ? Math.round((p.price * grams) / 1000) : p.price,
    ref: '', client: '',
  };
}

export interface LabelSize {
  /** Largeur et hauteur en mm */
  w: number;
  h: number;
}

/** Tailles les plus courantes des planches A4 et des rouleaux d'étiquettes */
export const LABEL_SIZES: LabelSize[] = [
  { w: 38, h: 25 }, { w: 48, h: 30 }, { w: 60, h: 40 }, { w: 70, h: 37 }, { w: 97, h: 46 }, { w: 97, h: 70 }, { w: 97, h: 90 },
];

export const DEFAULT_LABEL_SIZE: LabelSize = { w: 60, h: 40 };

/** Surface imprimable d'une page A4 avec 8 mm de marge */
const A4_WIDTH = 194;
const A4_HEIGHT = 281;
const MIN_W = 30;
const MIN_H = 20;

const inRange = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value) || min));

/** Taille utilisable : un ticket doit rester lisible et tenir sur la feuille. */
export const clampSize = (s: LabelSize): LabelSize => ({ w: inRange(s.w, MIN_W, A4_WIDTH), h: inRange(s.h, MIN_H, A4_HEIGHT) });

/** Colonnes, lignes et nombre de pages pour imprimer ces tickets sur du A4. */
export function a4Layout(size: LabelSize, count: number) {
  const columns = Math.max(1, Math.floor(A4_WIDTH / size.w));
  const rows = Math.max(1, Math.floor(A4_HEIGHT / size.h));
  const perPage = columns * rows;
  return { columns, rows, perPage, pages: Math.ceil(count / perPage) };
}

/** Le dessin de référence fait 60 × 40 mm : le texte grandit avec le ticket. */
export const labelScale = (s: LabelSize) => Math.round(Math.min(s.w / DEFAULT_LABEL_SIZE.w, s.h / DEFAULT_LABEL_SIZE.h) * 1000) / 1000;
