import { Invoice, vatPart } from './invoice';

/** Client professionnel */
export interface Company {
  id: string;
  name: string;
  nif: string;
  nis: string;
  rc: string;
  ai: string;
  address: string;
  tel: string;
  contact: string;
}

export type PaymentMode = 'virement' | 'chèque' | 'espèces' | 'à terme';
export const PAYMENT_MODES: PaymentMode[] = ['virement', 'chèque', 'espèces', 'à terme'];

export interface ProLine {
  productId: string;
  label: string;
  qty: number;
  /** kg, pièce, carton… */
  unit: string;
  priceHt: number;
  vatRate: number;
}

export interface ProTotals {
  totalHtBrut: number;
  discount: number;
  totalHt: number;
  /** TVA par taux, pour une facture qui mélange plusieurs taux */
  vat: { rate: number; base: number; amount: number }[];
  totalVat: number;
  stamp: number;
  ttc: number;
}

export interface ProDetails extends ProTotals {
  client: Omit<Company, 'id'>;
  lines: ProLine[];
  discountRate: number;
  amountWords: string;
  payment: PaymentMode;
  /** AAAA-MM-JJ */
  dueDate: string;
  /** Montant déjà encaissé */
  paid: number;
  /** Vrai si le stock a été déduit à l'émission */
  stockDeducted: boolean;
}

/** Arrondi à 2 décimales, insensible aux erreurs de virgule flottante (27499,8749999 → 27499,88) */
export const round2 = (n: number) => Math.round(Number((n * 100).toFixed(6))) / 100;

export const lineHt = (l: Pick<ProLine, 'qty' | 'priceHt'>) => round2(l.qty * l.priceHt);

/** Totaux d'une facture pro. Le timbre ne s'applique qu'au paiement en espèces. */
export function computePro(lines: ProLine[], discountRate: number, payment: PaymentMode, stampRate: number): ProTotals {
  const totalHtBrut = round2(lines.reduce((sum, l) => sum + lineHt(l), 0));
  const factor = 1 - discountRate / 100;
  const byRate = new Map<number, number>();
  for (const l of lines) byRate.set(l.vatRate, (byRate.get(l.vatRate) ?? 0) + lineHt(l) * factor);
  const vat = [...byRate].filter(([rate]) => rate > 0)
    .map(([rate, base]) => ({ rate, base: round2(base), amount: round2((base * rate) / 100) }))
    .sort((a, b) => a.rate - b.rate);
  const totalHt = round2(totalHtBrut * factor);
  const totalVat = round2(vat.reduce((sum, v) => sum + v.amount, 0));
  const beforeStamp = round2(totalHt + totalVat);
  const stamp = payment === 'espèces' ? round2((beforeStamp * stampRate) / 100) : 0;
  return { totalHtBrut, discount: round2(totalHtBrut - totalHt), totalHt, vat, totalVat, stamp, ttc: round2(beforeStamp + stamp) };
}

const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize',
  'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

function below100(n: number): string {
  if (n < 20) return UNITS[n];
  if (n < 70) {
    const t = Math.floor(n / 10), u = n % 10;
    return u === 0 ? TENS[t] : u === 1 ? `${TENS[t]} et un` : `${TENS[t]}-${UNITS[u]}`;
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${UNITS[n - 60]}`;
  if (n === 80) return 'quatre-vingts';
  return `quatre-vingt-${UNITS[n - 80]}`;
}

function below1000(n: number, last: boolean): string {
  const h = Math.floor(n / 100), r = n % 100;
  const hundreds = h === 0 ? '' : h === 1 ? 'cent' : `${UNITS[h]} cent${r === 0 && last ? 's' : ''}`;
  const rest = r === 0 ? '' : below100(r);
  const text = [hundreds, rest].filter(Boolean).join(' ');
  // « quatre-vingt mille » : pas de s devant mille
  return last ? text : text.replace(/quatre-vingts$/, 'quatre-vingt');
}

export function numberToWords(n: number): string {
  if (n === 0) return UNITS[0];
  const billions = Math.floor(n / 1e9), millions = Math.floor(n / 1e6) % 1000;
  const thousands = Math.floor(n / 1e3) % 1000, rest = n % 1000;
  const parts: string[] = [];
  if (billions) parts.push(`${below1000(billions, true)} milliard${billions > 1 ? 's' : ''}`);
  if (millions) parts.push(`${below1000(millions, true)} million${millions > 1 ? 's' : ''}`);
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${below1000(thousands, false)} mille`);
  if (rest) parts.push(below1000(rest, true));
  return parts.join(' ');
}

/** « Arrêtée la présente facture à la somme de… » */
export function amountInWords(amount: number): string {
  const whole = Math.floor(amount), cents = Math.round((amount - whole) * 100);
  const dinars = `${numberToWords(whole)} dinar${whole > 1 ? 's' : ''} algérien${whole > 1 ? 's' : ''}`;
  const text = cents ? `${dinars} et ${numberToWords(cents)} centime${cents > 1 ? 's' : ''}` : dinars;
  return text[0].toUpperCase() + text.slice(1);
}

export type PaymentState = 'payée' | 'partielle' | 'impayée' | 'en retard';

export function paymentState(inv: Invoice, today: string): PaymentState | null {
  if (!inv.pro) return null;
  const left = round2(inv.pro.ttc - inv.pro.paid);
  if (left <= 0) return 'payée';
  if (inv.pro.dueDate && inv.pro.dueDate < today) return 'en retard';
  return inv.pro.paid > 0 ? 'partielle' : 'impayée';
}

export interface DeclarationRow {
  date: string;
  number: string;
  client: string;
  nif: string;
  ht: number;
  tva: number;
  stamp: number;
  ttc: number;
  payment: string;
}

/** Une ligne par facture de la période. Les factures annulées ne sont pas déclarées. */
export function declarationRows(invoices: Invoice[], from: string, to: string): DeclarationRow[] {
  return invoices
    .filter(i => i.status !== 'annulée' && i.date >= from && i.date <= to)
    .map((i): DeclarationRow => {
      if (i.pro) {
        return {
          date: i.date, number: i.number, client: i.pro.client.name, nif: i.pro.client.nif,
          ht: i.pro.totalHt, tva: i.pro.totalVat, stamp: i.pro.stamp, ttc: i.pro.ttc, payment: i.pro.payment,
        };
      }
      const tva = vatPart(i.total, i.vatRate);
      return {
        date: i.date, number: i.number, client: i.customer.name, nif: '',
        ht: round2(i.total - tva), tva, stamp: 0, ttc: i.total, payment: 'à la réception',
      };
    })
    .sort((a, b) => a.number.localeCompare(b.number));
}

export function declarationTotals(rows: DeclarationRow[]) {
  const sum = (key: 'ht' | 'tva' | 'stamp' | 'ttc') => round2(rows.reduce((s, r) => s + r[key], 0));
  return { ht: sum('ht'), tva: sum('tva'), stamp: sum('stamp'), ttc: sum('ttc') };
}

/** Fichier CSV pour Excel : point-virgule et BOM, sinon les accents et colonnes s'affichent mal en français. */
export function declarationCsv(rows: DeclarationRow[]) {
  const cell = (v: string | number) => {
    const s = typeof v === 'number' ? String(v).replace('.', ',') : v;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['Date', 'Numéro', 'Client', 'NIF', 'Montant HT', 'TVA', 'Timbre', 'Montant TTC', 'Paiement'];
  const body = rows.map(r => [r.date, r.number, r.client, r.nif, r.ht, r.tva, r.stamp, r.ttc, r.payment].map(cell).join(';'));
  return `﻿${[head.join(';'), ...body].join('\r\n')}`;
}
