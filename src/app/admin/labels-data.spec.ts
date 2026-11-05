import { Order, Product } from '../core/data';
import { DEFAULT_LABEL_FIELDS, a4Layout, clampSize, labelDates, labelScale, labelsFromOrder, manualLabel, morningLabels } from './labels-data';

const order = (items: Order['items']): Order => ({
  id: 'abcdef123456', name: 'Karim', tel: '', type: 'retrait', typeLabel: '', date: '', details: '', lang: 'fr', status: 'confirmé', items,
});

const kefta: Product = {
  id: 'kefta', category: 'preparations', order: 1, available: true, price: 2200, unit: 'kg',
  name_fr: 'Kefta', name_ar: 'كفتة', desc_fr: '', desc_ar: '',
};

describe('Étiquettes', () => {
  it('imprime une étiquette par paquet, avec le montant du paquet', () => {
    const labels = labelsFromOrder(order([
      { productId: 'b', unit: 'kg', grams: 500, qty: 2, name_fr: 'Blanc', name_ar: 'صدر', option_fr: 'Escalopes', price: 1100, total: 1100 },
    ]));
    expect(labels).toHaveLength(2);
    expect(labels[0]).toEqual({
      name_fr: 'Blanc', name_ar: 'صدر', detail: 'Escalopes', weight: '500 g', priceKg: 1100, amount: 550, ref: '123456'.toUpperCase(), client: 'Karim',
    });
  });

  it('arrondit le poids d\'une commande au montant', () => {
    const [l] = labelsFromOrder(order([{ productId: 'k', unit: 'kg', grams: 227.27, qty: 1, name_fr: 'Kefta', price: 2200, total: 500 }]));
    expect([l.weight, l.amount]).toEqual(['227 g', 500]);
  });

  it('écrit les kilos', () => {
    const [l] = labelsFromOrder(order([{ productId: 'g', unit: 'kg', grams: 1500, qty: 1, name_fr: 'Gigot', price: 3000, total: 4500 }]));
    expect(l.weight).toBe('1,5 kg');
  });

  it('ignore les anciennes commandes sans nom d\'article', () => {
    expect(labelsFromOrder(order([{ productId: 'x', unit: 'kg', grams: 500, qty: 1 }]))).toEqual([]);
    expect(labelsFromOrder(order(undefined))).toEqual([]);
  });

  it('prépare les tickets du matin selon le nombre choisi', () => {
    const poulet = { ...kefta, id: 'poulet', name_fr: 'Poulet entier' };
    const labels = morningLabels([poulet, kefta], { poulet: 3, kefta: 0 });
    expect(labels).toHaveLength(3);
    expect(labels[0]).toMatchObject({ name_fr: 'Poulet entier', simple: true, weight: '', amount: 0, ref: '' });
  });

  it('ignore un nombre négatif ou absent', () => {
    expect(morningLabels([kefta], { kefta: -2 })).toEqual([]);
    expect(morningLabels([kefta], {})).toEqual([]);
  });

  it('calcule une étiquette manuelle', () => {
    expect(manualLabel(kefta, 400)).toMatchObject({ weight: '400 g', priceKg: 2200, amount: 880 });
  });

  it('garde le prix à la pièce sans poids', () => {
    expect(manualLabel({ ...kefta, unit: 'piece', price: 1500 }, 0)).toMatchObject({ weight: '', priceKg: 0, amount: 1500 });
  });
});

describe('Taille des tickets', () => {
  it('calcule la planche A4', () => {
    expect(a4Layout({ w: 60, h: 40 }, 30)).toEqual({ columns: 3, rows: 7, perPage: 21, pages: 2 });
    expect(a4Layout({ w: 97, h: 90 }, 6)).toEqual({ columns: 2, rows: 3, perPage: 6, pages: 1 });
    expect(a4Layout({ w: 38, h: 25 }, 0).pages).toBe(0);
  });

  it('garde un ticket lisible et dans la feuille', () => {
    expect(clampSize({ w: 5, h: 5 })).toEqual({ w: 30, h: 20 });
    expect(clampSize({ w: 500, h: 500 })).toEqual({ w: 194, h: 281 });
    expect(clampSize({ w: 72.4, h: 41 })).toEqual({ w: 72, h: 41 });
  });

  it('agrandit le texte avec le ticket sans dépasser', () => {
    expect(labelScale({ w: 60, h: 40 })).toBe(1);
    expect(labelScale({ w: 120, h: 40 })).toBe(1);
    expect(labelScale({ w: 97, h: 90 })).toBe(1.617);
    expect(labelScale({ w: 30, h: 20 })).toBe(0.5);
  });
});

describe('Dates du ticket', () => {
  const dates = { date: '2026-11-05', expiry: '2026-11-08', arrival: '2026-11-04' };
  const short = (d: string) => d.slice(5);

  it('imprime les trois dates remplies', () => {
    expect(labelDates(DEFAULT_LABEL_FIELDS, dates, short).map(d => d.label)).toEqual(['Date', 'Arrivage', 'Expire le']);
  });

  it('ignore une date vide ou décochée', () => {
    const list = labelDates({ ...DEFAULT_LABEL_FIELDS, arrival: false }, { ...dates, expiry: '' }, short);
    expect(list).toEqual([{ label: 'Date', value: '11-05' }]);
  });
});
