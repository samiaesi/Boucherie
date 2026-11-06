import { Campaign, blankCampaign, campaignProducts, openCampaigns, validPickup } from './campaigns';
import { DEFAULT_CUSTOM, Product } from './data';

const campaign = (extra: Partial<Campaign>): Campaign => ({
  ...blankCampaign(), id: 'aid', closes: '2027-05-10', pickupFrom: '2027-05-12', pickupTo: '2027-05-15', products: ['a'], ...extra,
});
const product = (id: string, extra: Partial<Product> = {}): Product => ({
  id, category: 'agneau', order: 1, available: true, unit: 'kg', price: 2600, name_fr: id, name_ar: id, desc_fr: '', desc_ar: '', ...extra,
});

describe('Réservations', () => {
  it('ouvre jusqu\'au dernier jour inclus', () => {
    expect(openCampaigns([campaign({})], '2027-05-10')).toHaveLength(1);
    expect(openCampaigns([campaign({})], '2027-05-11')).toEqual([]);
  });

  it('cache une réservation désactivée ou sans produit', () => {
    expect(openCampaigns([campaign({ active: false }), campaign({ products: [] })], '2027-01-01')).toEqual([]);
  });

  it('montre d\'abord celle qui se termine le plus tôt', () => {
    const list = [campaign({ id: 'b', closes: '2027-06-01' }), campaign({ id: 'a', closes: '2027-02-01' })];
    expect(openCampaigns(list, '2027-01-01').map(c => c.id)).toEqual(['a', 'b']);
  });

  it('ne garde que les produits réservables', () => {
    const c = campaign({ products: ['ok', 'off', 'out', 'perso', 'gone'] });
    const products = [product('ok'), product('off', { available: false }), product('out', { trackStock: true, stock: 0 }), product('perso', { custom: DEFAULT_CUSTOM })];
    expect(campaignProducts(c, products).map(p => p.id)).toEqual(['ok']);
  });

  it('limite le retrait aux dates prévues', () => {
    const c = campaign({});
    expect(validPickup(c, '2027-05-12')).toBe(true);
    expect(validPickup(c, '2027-05-15')).toBe(true);
    expect(validPickup(c, '2027-05-11')).toBe(false);
    expect(validPickup(c, '')).toBe(false);
  });
});
