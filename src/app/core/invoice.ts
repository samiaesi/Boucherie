import { Lang, Order, OrderItem, Settings } from './data';
import { ProDetails } from './pro-invoice';

export interface InvoiceLine {
  productId: string;
  name_fr: string;
  name_ar: string;
  /** Poids et découpe, déjà dans la langue du client */
  detail: string;
  qty: number;
  price: number;
  total: number;
}

export interface Invoice {
  id: string;
  number: string;
  orderId: string;
  status: 'émise' | 'annulée';
  /** AAAA-MM-JJ */
  date: string;
  lang: Lang;
  customer: { name: string; tel: string; address?: string };
  delivery: boolean;
  lines: InvoiceLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  vatRate: number;
  /** Détails d'une facture d'entreprise */
  pro?: ProDetails;
  /** Instantané du vendeur : une facture émise ne change plus si les paramètres changent */
  seller: { name: string; company: string; address: string; phone: string; nif: string; nis: string; rc: string; ai: string };
}

export const invoiceNumber = (year: number, n: number) => `FA-${year}-${String(n).padStart(4, '0')}`;

/** Part de TVA comprise dans un montant TTC */
export const vatPart = (total: number, rate: number) => (rate ? Math.round(total - total / (1 + rate / 100)) : 0);

function detail(i: OrderItem, lang: Lang) {
  const weight = i.grams ? `${Math.round(i.grams)} ${lang === 'ar' ? 'غ' : 'g'}` : '';
  const option = lang === 'ar' ? i.option_ar || i.option_fr : i.option_fr;
  return [weight, option].filter(Boolean).join(' · ');
}

export function buildInvoice(o: Order, s: Settings, number: string, date: string): Omit<Invoice, 'id'> {
  const lines = (o.items ?? []).map((i): InvoiceLine => ({
    productId: i.productId, name_fr: i.name_fr ?? '', name_ar: i.name_ar ?? '', detail: detail(i, o.lang),
    qty: i.qty, price: i.price ?? 0, total: i.total ?? 0,
  }));
  const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
  const deliveryFee = o.delivery ?? 0;
  return {
    number, orderId: o.id, status: 'émise', date, lang: o.lang,
    customer: { name: o.name, tel: o.tel, ...(o.address ? { address: o.address } : {}) },
    delivery: o.type === 'livraison',
    lines, subtotal, deliveryFee, total: subtotal + deliveryFee, vatRate: s.vatRate,
    seller: {
      name: s.name_fr, company: s.company, address: s.address_fr, phone: s.phone,
      nif: s.nif, nis: s.nis, rc: s.rc, ai: s.ai,
    },
  };
}
