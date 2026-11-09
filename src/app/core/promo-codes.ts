/** Code promo, enregistré sous son nom (en majuscules) dans promoCodes/{CODE} */
export interface PromoCode {
  id: string;
  /** Réduction en % sur les articles (hors livraison) */
  percent: number;
  /** Dernier jour de validité AAAA-MM-JJ, vide = sans fin */
  until?: string;
  /** Montant minimum des articles en DA */
  minOrder?: number;
  /** Nombre d'utilisations au maximum, vide = illimité */
  maxUses?: number;
  uses: number;
  active: boolean;
  /** Mémo pour l'équipe (« Aïd 2026 », « Instagram »…) */
  note?: string;
}

/** « aid 10 » → « AID10 » */
export const normalizeCode = (text: string) => text.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');

/** Ce qui empêche d'utiliser le code, sinon null */
export function codeProblem(c: PromoCode | undefined, subtotal: number, today: string): 'promoUnknown' | 'promoExpired' | 'promoMin' | 'promoUsed' | null {
  if (!c || !c.active || !(c.percent > 0)) return 'promoUnknown';
  if (c.until && today > c.until) return 'promoExpired';
  if (c.maxUses && c.uses >= c.maxUses) return 'promoUsed';
  if (c.minOrder && subtotal < c.minOrder) return 'promoMin';
  return null;
}

/** Réduction en DA, arrondie, jamais plus que les articles */
export const discountFor = (percent: number, subtotal: number) =>
  Math.min(subtotal, Math.max(0, Math.round((subtotal * percent) / 100)));
