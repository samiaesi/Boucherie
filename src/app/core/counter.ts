import { OrderItem, Product, availableOrigins, defaultOriginIndex, lowestPrice, originsOf, roundStock } from './data';

/** Ligne du ticket de caisse, modifiable avant d'encaisser */
export interface TicketLine {
  key: number;
  product: Product;
  origin?: string;
  /** Poids en grammes (vente au kg) */
  grams: number;
  /** Nombre de pièces (vente à la pièce) */
  qty: number;
  /** Prix du kg ou de la pièce, modifiable au comptoir */
  price: number;
}

/** Prix du produit pour un pays (celui du pays, sinon le plus bas) */
export function priceFor(p: Product, origin?: string) {
  const o = originsOf(p).find(x => x.country === origin);
  return o?.price || lowestPrice(p) || p.price || 0;
}

/** Nouvelle ligne : le pays proposé en premier, 1 kg ou 1 pièce */
export function newLine(p: Product, key: number): TicketLine {
  const origins = availableOrigins(p).length ? availableOrigins(p) : originsOf(p);
  const origin = origins.length ? origins[defaultOriginIndex(origins)]?.country : undefined;
  return { key, product: p, origin, grams: p.unit === 'kg' ? 1000 : 0, qty: 1, price: priceFor(p, origin) };
}

export const lineTotal = (l: TicketLine) =>
  Math.round(l.product.unit === 'kg' ? (l.grams / 1000) * l.price * Math.max(1, l.qty) : l.qty * l.price);

export const ticketTotal = (lines: TicketLine[]) => lines.reduce((sum, l) => sum + lineTotal(l), 0);

/** Lignes de la commande enregistrée, au même format que les commandes du site */
export function ticketItems(lines: TicketLine[]): OrderItem[] {
  return lines.filter(l => lineTotal(l) > 0).map(l => ({
    productId: l.product.id, unit: l.product.unit, qty: l.product.unit === 'kg' ? 1 : l.qty,
    ...(l.product.unit === 'kg' ? { grams: Math.round(l.grams) } : {}),
    ...(l.origin ? { origin: l.origin } : {}),
    name_fr: l.product.name_fr, name_ar: l.product.name_ar, price: l.price, total: lineTotal(l),
  }));
}

/** « 1,25 kg » ou « 3 pièce(s) » */
export const lineAmount = (l: TicketLine) =>
  l.product.unit === 'kg' ? `${roundStock(l.grams / 1000).toString().replace('.', ',')} kg` : `${l.qty} pièce(s)`;
