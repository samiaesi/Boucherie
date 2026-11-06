import { Order, Product } from './data';
import { arrivalAge, parseSlots, slotFull, slotInLabel, slotKey } from './delivery-slots';
import { salesReport } from './sales';

const at = new Date('2026-11-05T10:00:00Z');
const from = new Date('2026-11-01T00:00:00Z'), to = new Date('2026-11-07T00:00:00Z');
const order = (extra: Partial<Order>): Order => ({
  id: 'o', name: 'a', tel: '0', type: 'retrait', typeLabel: '', date: '', details: '', lang: 'fr', status: 'récupéré', createdAt: at, total: 1000,
  items: [{ productId: 'a', unit: 'kg', grams: 500, qty: 2, name_fr: 'Kefta', total: 1000 }], ...extra,
});
const product = (id: string, available = true) => ({ id, available } as Product);

describe('Rapport des ventes', () => {
  it('additionne par produit et classe par chiffre d\'affaires', () => {
    const r = salesReport([
      order({}), order({ items: [{ productId: 'b', unit: 'piece', qty: 3, name_fr: 'Bouzellouf', total: 3000 }, { productId: 'a', unit: 'kg', grams: 250, qty: 1, name_fr: 'Kefta', total: 500 }] }),
    ], [], from, to);
    expect(r).toMatchObject({ orders: 2, revenue: 4500, average: 2250 });
    expect(r.rows.map(x => [x.name, x.qty, x.grams, x.revenue, x.share])).toEqual([['Bouzellouf', 3, 0, 3000, 67], ['Kefta', 0, 1250, 1500, 33]]);
  });

  it('ignore les commandes annulées ou hors période', () => {
    const r = salesReport([order({ status: 'annulé' }), order({ createdAt: new Date('2026-10-01') })], [], from, to);
    expect(r).toMatchObject({ orders: 0, revenue: 0, average: 0, rows: [] });
  });

  it('liste les produits en vente qui ne se vendent pas', () => {
    expect(salesReport([order({})], [product('a'), product('z'), product('hidden', false)], from, to).unsold.map(p => p.id)).toEqual(['z']);
  });
});

describe('Créneaux de livraison', () => {
  it('nomme le compteur et lit le créneau', () => {
    expect(slotKey('2026-11-07', '10:00-12:00')).toBe('2026-11-07_1000-1200');
    expect(slotInLabel('Livraison 10:00-12:00 · Panier')).toBe('10:00-12:00');
    expect(slotInLabel('Commande spéciale 13:00 · Panier')).toBe('');
  });

  it('ne limite rien sans maximum', () => {
    expect(slotFull(50, 0)).toBe(false);
    expect(slotFull(4, 5)).toBe(false);
    expect(slotFull(5, 5)).toBe(true);
  });

  it('écarte les lignes mal écrites', () => {
    expect(parseSlots('10:00-12:00\n 14:00 - 16:00 \nmatin')).toEqual(['10:00-12:00', '14:00-16:00']);
  });
});

describe('Date d\'arrivage', () => {
  it('annonce seulement un arrivage récent', () => {
    expect(arrivalAge('2026-11-06', '2026-11-06')).toBe(0);
    expect(arrivalAge('2026-11-05', '2026-11-06')).toBe(1);
    expect(arrivalAge('2026-11-01', '2026-11-06')).toBeNull();
    expect(arrivalAge(undefined, '2026-11-06')).toBeNull();
  });
});
