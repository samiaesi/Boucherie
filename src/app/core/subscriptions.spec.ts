import { OrderItem, Product } from './data';
import { Subscription, duePanels, nextDate, refreshItems } from './subscriptions';

const sub = (over: Partial<Subscription>): Subscription => ({
  id: 's', name: 'Karim', tel: '0555123456', type: 'retrait', day: 4, items: [], lang: 'fr', active: true, ...over,
});

describe('panier de la semaine', () => {
  // 2026-11-09 est un lundi
  it('trouve la prochaine date du jour choisi', () => {
    expect(nextDate(1, '2026-11-09')).toBe('2026-11-09');
    expect(nextDate(4, '2026-11-09')).toBe('2026-11-12');
    expect(nextDate(0, '2026-11-09')).toBe('2026-11-15');
  });

  it('liste les paniers des deux prochains jours qui n\'ont pas encore leur commande', () => {
    const due = duePanels([
      sub({ id: 'a', day: 2 }), sub({ id: 'b', day: 1, lastOrder: '2026-11-09' }), sub({ id: 'c', day: 5 }), sub({ id: 'd', day: 1, active: false }),
    ], '2026-11-09');
    expect(due.map(d => [d.sub.id, d.date])).toEqual([['a', '2026-11-10']]);
  });

  it('remet les prix du jour et écarte les produits retirés', () => {
    const items = [
      { productId: 'gigot', unit: 'kg', grams: 1500, qty: 1, origin: 'Algérie', name_fr: 'Gigot', price: 3000, total: 4500 },
      { productId: 'vieux', unit: 'kg', grams: 500, qty: 1, name_fr: 'Ancien produit' },
    ] as OrderItem[];
    const products = [{ id: 'gigot', unit: 'kg', price: 0, available: true, origins: [{ country: 'Algérie', price: 3200 }] }] as Product[];
    const r = refreshItems(items, products);
    expect([r.items[0].price, r.items[0].total, r.missing, r.total]).toEqual([3200, 4800, ['Ancien produit'], 4800]);
  });
});
