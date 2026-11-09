import { Product } from './data';
import { lineAmount, lineTotal, newLine, priceFor, ticketItems, ticketTotal } from './counter';

const gigot = { id: 'gigot', name_fr: 'Gigot', name_ar: 'فخذ', unit: 'kg', price: 0, available: true,
  origins: [{ country: 'Espagne', price: 3000 }, { country: 'Algérie', price: 3600 }] } as Product;
const merguez = { id: 'merguez', name_fr: 'Merguez', name_ar: 'مرقاز', unit: 'piece', price: 150, available: true } as Product;

describe('caisse', () => {
  it('propose l\'Algérie en premier et son prix', () => {
    const l = newLine(gigot, 1);
    expect([l.origin, l.price, l.grams]).toEqual(['Algérie', 3600, 1000]);
    expect(priceFor(gigot, 'Espagne')).toBe(3000);
  });

  it('calcule le ticket au poids et à la pièce', () => {
    const lines = [{ ...newLine(gigot, 1), grams: 1250 }, { ...newLine(merguez, 2), qty: 4 }];
    expect(lines.map(lineTotal)).toEqual([4500, 600]);
    expect(ticketTotal(lines)).toBe(5100);
    expect(lineAmount(lines[0])).toBe('1,25 kg');
  });

  it('enregistre les lignes comme une commande du site', () => {
    const [kg, piece] = ticketItems([{ ...newLine(gigot, 1), grams: 1250 }, { ...newLine(merguez, 2), qty: 4 }]);
    expect(kg).toEqual({ productId: 'gigot', unit: 'kg', qty: 1, grams: 1250, origin: 'Algérie', name_fr: 'Gigot', name_ar: 'فخذ', price: 3600, total: 4500 });
    expect([piece.qty, piece.total, 'grams' in piece]).toEqual([4, 600, false]);
  });
});
