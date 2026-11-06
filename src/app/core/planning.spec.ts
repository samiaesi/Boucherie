import { Order, OrderItem, Product } from './data';
import { planningDays, slotTime } from './planning';
import { applyPromos, countdown, promoActive, secondsLeft } from './promo';

const item = (extra: Partial<OrderItem>): OrderItem => ({ productId: 'p', unit: 'piece', qty: 1, special: true, name_fr: 'Poulet farci', ...extra });
const order = (id: string, extra: Partial<Order>): Order => ({
  id, name: id, tel: '0555', type: 'retrait', typeLabel: 'Commande spéciale 13:00 · Panier', date: '2026-11-10', details: '', lang: 'fr', status: 'confirmé', items: [item({})], ...extra,
});

describe('Planning de préparation', () => {
  it('lit l\'heure du créneau', () => {
    expect(slotTime({ typeLabel: 'Commande spéciale 09:00 · Panier · 2 articles · 800 DA' })).toBe('09:00');
    expect(slotTime({ typeLabel: 'Mouton de l\'Aïd · 50 000 DA' })).toBe('');
  });

  it('classe par jour puis par heure, les réservations sans heure à la fin', () => {
    const days = planningDays([
      order('b', { date: '2026-11-11' }), order('c', { typeLabel: 'Réservation' }),
      order('a', { typeLabel: 'Commande spéciale 09:00 · Panier' }), order('d', {}),
    ], '2026-11-10', '2026-11-12');
    expect(days.map(d => d.date)).toEqual(['2026-11-10', '2026-11-11']);
    expect(days[0].entries.map(e => e.order.id)).toEqual(['a', 'd', 'c']);
  });

  it('écarte les commandes finies, normales ou hors période', () => {
    const days = planningDays([
      order('a', { status: 'annulé' }), order('b', { status: 'récupéré' }), order('c', { status: 'livré' }),
      order('d', { items: [item({ special: false })] }), order('e', { date: '2026-12-01' }),
    ], '2026-11-10', '2026-11-12');
    expect(days).toEqual([]);
  });

  it('additionne ce qu\'il faut préparer dans la journée', () => {
    const [day] = planningDays([
      order('a', { items: [item({ qty: 2, option_fr: 'Bœuf 500 g' })] }),
      order('b', { items: [item({ qty: 1, option_fr: 'Bœuf 500 g' }), item({ name_fr: 'Merguez', unit: 'kg', grams: 500, qty: 2 })] }),
    ], '2026-11-10', '2026-11-10');
    expect(day.totals).toEqual([
      { name: 'Merguez', option: '', qty: 2, grams: 1000 },
      { name: 'Poulet farci', option: 'Bœuf 500 g', qty: 3, grams: 0 },
    ]);
  });
});

describe('Promotions', () => {
  const product = (extra: Partial<Product>): Product => ({
    id: 'p', category: 'x', order: 1, available: true, unit: 'kg', price: 1000, name_fr: 'p', name_ar: 'p', desc_fr: '', desc_ar: '',
    promoPercent: 20, promoUntil: '2026-11-10', ...extra,
  });

  it('baisse le prix jusqu\'au dernier jour inclus, puis le remet', () => {
    expect(applyPromos([product({})], '2026-11-10')[0]).toMatchObject({ price: 800, oldPrice: 1000 });
    expect(applyPromos([product({})], '2026-11-11')[0].price).toBe(1000);
  });

  it('baisse tous les pays du même pourcentage', () => {
    const p = applyPromos([product({ origins: [{ country: 'Algérie', price: 1000 }, { country: 'Espagne', price: 500 }] })], '2026-11-01')[0];
    expect(p.origins!.map(o => o.price)).toEqual([800, 400]);
    expect(p.oldPrice).toBe(500);
  });

  it('écarte les produits sans prix ou personnalisés et les remises absurdes', () => {
    expect(promoActive(product({ unit: 'order' }), '2026-11-01')).toBe(false);
    expect(promoActive(product({ promoPercent: 95 }), '2026-11-01')).toBe(false);
    expect(promoActive(product({ promoUntil: '' }), '2026-11-01')).toBe(false);
  });

  it('compte le temps restant à l\'heure d\'Algérie', () => {
    expect(secondsLeft('2026-11-10', new Date('2026-11-10T22:59:00Z'))).toBe(59);
    expect(secondsLeft('2026-11-10', new Date('2026-11-11T00:00:00Z'))).toBe(0);
    expect(countdown(3661)).toBe('01:01:01');
    expect(countdown(90061)).toBe('1 j 01:01:01');
  });
});
