import { Invoice } from './invoice';
import {
  ProDetails, ProLine, amountInWords, computePro, declarationCsv, declarationRows, declarationTotals, numberToWords, paymentState,
} from './pro-invoice';

const line = (over: Partial<ProLine>): ProLine => ({ productId: '', label: 'Viande', qty: 100, unit: 'kg', priceHt: 1000, vatRate: 19, ...over });

const invoice = (over: Partial<Invoice>): Invoice => ({
  id: 'x', number: 'FA-2026-0001', orderId: '', status: 'émise', date: '2026-11-04', lang: 'fr',
  customer: { name: 'Karim', tel: '' }, delivery: false, lines: [], subtotal: 1190, deliveryFee: 0, total: 1190, vatRate: 19,
  seller: { name: '', company: '', address: '', phone: '', nif: '', nis: '', rc: '', ai: '' }, ...over,
});

const pro = (over: Partial<ProDetails>) => ({
  client: { name: 'Hôtel', nif: '123', nis: '', rc: '', ai: '', address: '', tel: '', contact: '' }, lines: [], discountRate: 0,
  amountWords: '', payment: 'virement', dueDate: '2026-12-01', paid: 0, stockDeducted: false, totalHtBrut: 100000, discount: 0,
  totalHt: 100000, vat: [], totalVat: 19000, stamp: 0, ttc: 119000, ...over,
}) as ProDetails;

describe('computePro', () => {
  it('calcule HT, TVA et TTC', () => {
    const t = computePro([line({})], 0, 'virement', 1);
    expect([t.totalHt, t.totalVat, t.ttc, t.stamp]).toEqual([100000, 19000, 119000, 0]);
  });

  it('applique la remise avant la TVA', () => {
    const t = computePro([line({})], 10, 'virement', 0);
    expect([t.discount, t.totalHt, t.totalVat, t.ttc]).toEqual([10000, 90000, 17100, 107100]);
  });

  it('sépare la TVA par taux', () => {
    const t = computePro([line({ qty: 10 }), line({ qty: 10, vatRate: 9 }), line({ qty: 10, vatRate: 0 })], 0, 'virement', 0);
    expect(t.vat).toEqual([{ rate: 9, base: 10000, amount: 900 }, { rate: 19, base: 10000, amount: 1900 }]);
    expect(t.ttc).toBe(32800);
  });

  it('ajoute le timbre seulement en espèces', () => {
    expect(computePro([line({})], 0, 'espèces', 1).stamp).toBe(1190);
    expect(computePro([line({})], 0, 'chèque', 1).stamp).toBe(0);
  });

  it('accepte les quantités décimales', () => {
    expect(computePro([line({ qty: 12.5, priceHt: 2199.99, vatRate: 0 })], 0, 'virement', 0).ttc).toBe(27499.88);
  });
});

describe('numberToWords', () => {
  it.each([
    [1, 'un'], [16, 'seize'], [21, 'vingt et un'], [22, 'vingt-deux'], [70, 'soixante-dix'], [71, 'soixante et onze'],
    [75, 'soixante-quinze'], [80, 'quatre-vingts'], [81, 'quatre-vingt-un'], [91, 'quatre-vingt-onze'], [100, 'cent'],
    [101, 'cent un'], [200, 'deux cents'], [201, 'deux cent un'], [1000, 'mille'], [1200, 'mille deux cents'],
    [2000, 'deux mille'], [80000, 'quatre-vingt mille'], [200000, 'deux cent mille'], [1000000, 'un million'],
    [2500000, 'deux millions cinq cent mille'], [1000000000, 'un milliard'],
  ])('%i', (n, words) => {
    expect(numberToWords(n)).toBe(words);
  });
});

describe('amountInWords', () => {
  it('écrit les dinars et les centimes', () => {
    expect(amountInWords(119000)).toBe('Cent dix-neuf mille dinars algériens');
    expect(amountInWords(1)).toBe('Un dinar algérien');
    expect(amountInWords(1250.5)).toBe('Mille deux cent cinquante dinars algériens et cinquante centimes');
  });
});

describe('paymentState', () => {
  const inv = (p: Partial<ProDetails>) => invoice({ pro: pro(p) });

  it('suit le paiement', () => {
    expect(paymentState(inv({}), '2026-11-04')).toBe('impayée');
    expect(paymentState(inv({ paid: 50000 }), '2026-11-04')).toBe('partielle');
    expect(paymentState(inv({ paid: 119000 }), '2026-11-04')).toBe('payée');
  });

  it('signale le retard après l\'échéance, sauf si tout est payé', () => {
    expect(paymentState(inv({ paid: 50000 }), '2026-12-02')).toBe('en retard');
    expect(paymentState(inv({ paid: 119000 }), '2026-12-02')).toBe('payée');
  });

  it('ne concerne pas les factures clients', () => {
    expect(paymentState(invoice({}), '2026-11-04')).toBeNull();
  });
});

describe('Déclaration', () => {
  const list = [
    invoice({ number: 'FA-2026-0002', date: '2026-11-10', pro: pro({}) }),
    invoice({ number: 'FA-2026-0001' }),
    invoice({ number: 'FA-2026-0003', status: 'annulée' }),
    invoice({ number: 'FA-2026-0004', date: '2026-10-31' }),
  ];

  it('garde la période, écarte les annulées et trie par numéro', () => {
    const rows = declarationRows(list, '2026-11-01', '2026-11-30');
    expect(rows.map(r => r.number)).toEqual(['FA-2026-0001', 'FA-2026-0002']);
  });

  it('sépare HT et TVA pour une facture client en TTC', () => {
    const [r] = declarationRows(list, '2026-11-01', '2026-11-30');
    expect([r.ht, r.tva, r.ttc]).toEqual([1000, 190, 1190]);
  });

  it('additionne la période', () => {
    expect(declarationTotals(declarationRows(list, '2026-11-01', '2026-11-30')))
      .toEqual({ ht: 101000, tva: 19190, stamp: 0, ttc: 120190 });
  });

  it('produit un CSV lisible par Excel', () => {
    const csv = declarationCsv(declarationRows(list, '2026-11-10', '2026-11-30'));
    expect(csv.startsWith('﻿Date;Numéro')).toBe(true);
    expect(csv).toContain('FA-2026-0002;Hôtel;123;100000;19000;0;119000;virement');
  });
});
