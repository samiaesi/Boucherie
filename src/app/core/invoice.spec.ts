import { DEFAULT_SETTINGS, Order } from './data';
import { buildInvoice, counterAfterDelete, invoiceNumber, vatPart } from './invoice';

const order: Order = {
  id: 'abc', name: 'Karim', tel: '0555123456', type: 'livraison', typeLabel: 'Panier', date: '2026-11-05', details: '',
  lang: 'fr', status: 'nouveau', address: 'Rue 1', delivery: 200, total: 3200,
  items: [
    { productId: 'gigot', unit: 'kg', grams: 1000, qty: 1, name_fr: 'Gigot', name_ar: 'فخذ', option_fr: 'Entier', price: 3000, total: 3000 },
  ],
};

describe('Facture', () => {
  it('numérote les factures par année', () => {
    expect(invoiceNumber(2026, 7)).toBe('FA-2026-0007');
  });

  it('reprend les lignes, la livraison et le total de la commande', () => {
    const inv = buildInvoice(order, DEFAULT_SETTINGS, 'FA-2026-0001', '2026-11-04');
    expect(inv.lines[0]).toMatchObject({ name_fr: 'Gigot', detail: '1000 g · Entier', qty: 1, total: 3000 });
    expect([inv.subtotal, inv.deliveryFee, inv.total, inv.delivery]).toEqual([3000, 200, 3200, true]);
    expect(inv.customer.address).toBe('Rue 1');
    expect(inv.seller.company).toBe('SARL Deligne');
  });

  it('écrit le détail dans la langue du client', () => {
    const inv = buildInvoice({ ...order, lang: 'ar' }, DEFAULT_SETTINGS, 'x', '2026-11-04');
    expect(inv.lines[0].detail).toContain('غ');
  });

  it('ne met aucune valeur indéfinie : Firestore les refuse', () => {
    const inv = buildInvoice({ ...order, address: undefined, type: 'retrait' }, DEFAULT_SETTINGS, 'x', '2026-11-04');
    expect(JSON.stringify(inv)).not.toContain('undefined');
    expect('address' in inv.customer).toBe(false);
  });

  it('calcule la TVA comprise dans un prix TTC', () => {
    expect(vatPart(1190, 19)).toBe(190);
    expect(vatPart(1190, 0)).toBe(0);
  });
});

describe('counterAfterDelete', () => {
  it('libère le dernier numéro', () => {
    expect(counterAfterDelete('FA-2026-0006', ['FA-2026-0005', 'FA-2026-0004'], 6)).toEqual({ year: 2026, value: 5 });
  });

  it('remet à zéro quand il ne reste aucune facture de l\'année', () => {
    expect(counterAfterDelete('FA-2026-0001', ['FA-2025-0040'], 1)).toEqual({ year: 2026, value: 0 });
  });

  it('ne touche pas au compteur pour une facture plus ancienne', () => {
    expect(counterAfterDelete('FA-2026-0003', ['FA-2026-0006'], 6)).toBeNull();
  });

  it('reprend au plus haut numéro restant si des factures ont été supprimées dans le désordre', () => {
    expect(counterAfterDelete('FA-2026-0006', ['FA-2026-0002'], 6)).toEqual({ year: 2026, value: 2 });
  });
});
