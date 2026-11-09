import { PromoCode, codeProblem, discountFor, normalizeCode } from './promo-codes';

const code = (over: Partial<PromoCode>): PromoCode => ({ id: 'AID10', percent: 10, uses: 0, active: true, ...over });

describe('codes promo', () => {
  it('écrit le code proprement', () => {
    expect(normalizeCode(' aid 10 ')).toBe('AID10');
  });

  it('refuse un code inconnu, désactivé, expiré, épuisé ou sous le minimum', () => {
    expect(codeProblem(undefined, 5000, '2026-11-09')).toBe('promoUnknown');
    expect(codeProblem(code({ active: false }), 5000, '2026-11-09')).toBe('promoUnknown');
    expect(codeProblem(code({ until: '2026-11-08' }), 5000, '2026-11-09')).toBe('promoExpired');
    expect(codeProblem(code({ maxUses: 3, uses: 3 }), 5000, '2026-11-09')).toBe('promoUsed');
    expect(codeProblem(code({ minOrder: 6000 }), 5000, '2026-11-09')).toBe('promoMin');
    expect(codeProblem(code({ until: '2026-11-09', minOrder: 5000 }), 5000, '2026-11-09')).toBeNull();
  });

  it('calcule la réduction sur les articles', () => {
    expect(discountFor(10, 4550)).toBe(455);
    expect(discountFor(150, 1000)).toBe(1000);
  });
});
