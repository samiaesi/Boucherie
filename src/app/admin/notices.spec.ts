import { DEFAULT_SETTINGS, Order, Product } from '../core/data';
import { NoticeInput, buildNotices } from './notices';

const now = new Date(2026, 10, 4, 12, 0);

const order = (over: Partial<Order>): Order => ({
  id: 'abc123', name: 'Karim', tel: '0555123456', type: 'retrait', typeLabel: 'Panier',
  date: '2026-11-04', details: '', lang: 'fr', status: 'nouveau', createdAt: now, ...over,
});

const product = (over: Partial<Product>): Product => ({
  id: 'kefta', category: 'preparations', order: 1, available: true, price: 2200, unit: 'kg',
  name_fr: 'Kefta', name_ar: 'كفتة', desc_fr: '', desc_ar: '', trackStock: true, stock: 10, stockAlert: 2, ...over,
});

const input = (over: Partial<NoticeInput>): NoticeInput => ({
  orders: [], products: [], fridge: [], now, online: true, error: '',
  settings: { ...DEFAULT_SETTINGS, whatsapp: '213555123456', phone: '0555123456' }, ...over,
});

const ids = (over: Partial<NoticeInput>) => buildNotices(input(over)).map(n => n.id);

describe('buildNotices', () => {
  it('reste vide quand tout va bien', () => {
    expect(ids({ products: [product({})] })).toEqual([]);
  });

  it('signale une rupture et un stock bas', () => {
    const list = buildNotices(input({ products: [
      product({ id: 'a', stock: 0 }),
      product({ id: 'b', stock: 1.5 }),
    ] }));
    expect(list.map(n => [n.id, n.level])).toEqual([['stock-out-a', 'danger'], ['stock-low-b', 'warn']]);
  });

  it('ignore les produits dont le stock n\'est pas suivi', () => {
    expect(ids({ products: [product({ id: 'a', stock: 0 }), product({ id: 'b', trackStock: false, stock: 0 })] }))
      .toEqual(['stock-out-a']);
  });

  it('fait passer une commande en urgence après 30 minutes', () => {
    const recent = new Date(now.getTime() - 29 * 60000), old = new Date(now.getTime() - 30 * 60000);
    expect(ids({ orders: [order({ createdAt: recent })] })).toEqual(['order-new-abc123']);
    const [late] = buildNotices(input({ orders: [order({ createdAt: old })] }));
    expect([late.id, late.level]).toEqual(['order-late-abc123', 'danger']);
  });

  it('signale une commande confirmée non récupérée, mais pas celle du jour', () => {
    expect(ids({ orders: [order({ status: 'confirmé', date: '2026-11-03' })] })).toEqual(['order-overdue-abc123']);
    expect(ids({ orders: [order({ status: 'confirmé' })] })).toEqual([]);
    expect(ids({ orders: [order({ status: 'récupéré', date: '2026-11-03' })] })).toEqual([]);
  });

  it('signale les problèmes du système', () => {
    const list = ids({ settings: DEFAULT_SETTINGS, online: false, error: 'refusé', products: [product({ trackStock: false })] });
    expect(list).toEqual(expect.arrayContaining([
      'system-offline', 'system-error', 'system-whatsapp', 'system-phone', 'system-stock-off',
    ]));
  });

  it('calcule la quantité à racheter depuis le maximum', () => {
    const [n] = buildNotices(input({ products: [product({ stock: 80, stockAlert: 100, stockMax: 300 })] }));
    expect(n.title).toBe('À remplir : Kefta');
    expect(n.text).toContain('À racheter : 220 kg');
  });

  it('signale un stock au-dessus du maximum', () => {
    expect(ids({ products: [product({ stock: 50, stockMax: 40 })] })).toEqual(['stock-over-kefta']);
  });

  it('rappelle d\'annoncer une date de retour', () => {
    const [n] = buildNotices(input({ products: [product({ stock: 0 })] }));
    expect(n.text).toContain('date de retour');
  });

  describe('réserve du frigo', () => {
    const sheep = { id: 'moutons', name: 'Moutons', tracked: true, kg: 500, min: 100, max: 300, kgEach: 20 };
    const gigot = product({ id: 'gigot-agneau', trackStock: false });

    it('alerte sous le minimum avec la quantité en kg et en bêtes', () => {
      const [low] = buildNotices(input({ fridge: [{ ...sheep, kg: 80 }] }));
      expect([low.id, low.level]).toEqual(['fridge-low-moutons', 'warn']);
      expect(low.text).toContain('Il reste 80 kg, soit environ 4 moutons');
      expect(low.text).toContain('À racheter : 220 kg, soit environ 11 moutons');
    });

    it('reste silencieuse entre le minimum et le maximum', () => {
      expect(ids({ fridge: [{ ...sheep, kg: 200 }] })).toEqual([]);
    });

    it('signale une réserve vide ou au-dessus du maximum', () => {
      expect(ids({ fridge: [{ ...sheep, kg: 0 }] })).toEqual(['fridge-empty-moutons']);
      expect(ids({ fridge: [{ ...sheep, kg: 350 }] })).toEqual(['fridge-over-moutons']);
    });

    it('ignore une réserve non suivie', () => {
      expect(ids({ fridge: [{ ...sheep, tracked: false, kg: 0 }] })).toEqual([]);
    });

    it('ne double pas l\'alerte sur le mouton entier, suivi par la réserve', () => {
      const whole = { ...gigot, id: 'mouton-entier', trackStock: true, stock: 0 };
      expect(ids({ products: [whole], fridge: [{ ...sheep, kg: 200 }] })).toEqual([]);
    });

    it('alerte quand une coupe découpée est épuisée', () => {
      expect(ids({ products: [{ ...gigot, stock: 0 }], fridge: [{ ...sheep, kg: 200 }] })).toEqual(['stock-out-gigot-agneau']);
    });
  });

  it('met les urgences en premier', () => {
    const list = buildNotices(input({ orders: [order({})], products: [product({ stock: 0 })] }));
    expect(list[0].level).toBe('danger');
  });
});
