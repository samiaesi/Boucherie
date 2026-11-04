import { Order } from './data';
import { daysBetween, orderStats } from './stats';

const order = (over: Partial<Order>): Order => ({
  id: 'a', name: 'K', tel: '', type: 'retrait', typeLabel: '', date: '', details: '', lang: 'fr', status: 'récupéré',
  createdAt: new Date(2026, 10, 4, 12), total: 1000, ...over,
});

const stats = (orders: Order[]) => orderStats(orders, '2026-11-03', '2026-11-05', []);

describe('orderStats', () => {
  it('compte chaque état de commande', () => {
    const s = stats([
      order({ status: 'nouveau' }), order({ status: 'en livraison' }), order({ status: 'livré', type: 'livraison' }),
      order({ status: 'récupéré' }), order({ status: 'annulé' }),
    ]);
    expect([s.received, s.inProgress, s.delivered, s.pickedUp, s.cancelled]).toEqual([5, 2, 1, 1, 1]);
  });

  it('exclut les commandes annulées du chiffre d\'affaires', () => {
    const s = stats([order({ total: 3000 }), order({ total: 1000 }), order({ total: 9000, status: 'annulé' })]);
    expect([s.revenue, s.average]).toEqual([4000, 2000]);
  });

  it('ignore les commandes hors période', () => {
    expect(stats([order({ createdAt: new Date(2026, 9, 1) })]).received).toBe(0);
  });

  it('remplit les jours sans commande', () => {
    expect(stats([order({})]).perDay).toEqual([
      { day: '2026-11-03', count: 0 }, { day: '2026-11-04', count: 1 }, { day: '2026-11-05', count: 0 },
    ]);
  });

  it('classe les produits par quantité vendue', () => {
    const s = stats([
      order({ items: [{ productId: 'a', unit: 'kg', grams: 500, qty: 2, name_fr: 'Gigot' }] }),
      order({ items: [{ productId: 'b', unit: 'kg', grams: 3000, qty: 1, name_fr: 'Poulet' }, { productId: 'a', unit: 'kg', grams: 500, qty: 1, name_fr: 'Gigot' }] }),
    ]);
    expect(s.topProducts).toEqual([{ label: 'Poulet', value: 3, unit: 'kg' }, { label: 'Gigot', value: 1.5, unit: 'kg' }]);
  });

  it('regroupe les livraisons par lieu', () => {
    const s = stats([
      order({ type: 'livraison', zone: 'Aïn El Berd' }), order({ type: 'livraison', zone: 'Aïn El Berd' }),
      order({ type: 'livraison', zone: 'Sidi Bel Abbès' }), order({ type: 'livraison' }), order({}),
    ]);
    expect(s.zones[0]).toEqual({ label: 'Aïn El Berd', value: 2 });
    expect(s.zones.map(z => z.label)).toContain('Non précisée');
    expect([s.deliveryOrders, s.pickupOrders]).toEqual([4, 1]);
  });

  it('signale les commandes sans montant sans fausser la moyenne', () => {
    const s = stats([order({ total: 2000 }), order({ total: undefined })]);
    expect([s.average, s.withoutAmount]).toEqual([2000, 1]);
  });
});

describe('daysBetween', () => {
  it('traverse un changement de mois', () => {
    expect(daysBetween('2026-10-31', '2026-11-01')).toEqual(['2026-10-31', '2026-11-01']);
  });
});
