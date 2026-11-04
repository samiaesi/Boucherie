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
