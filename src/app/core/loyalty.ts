/** Carte de fidélité d'un client. L'identifiant est son numéro ; aucun nom n'y figure car la lecture est publique. */
export interface LoyaltyCard {
  id: string;
  points: number;
  /** Points gagnés depuis le début */
  earned: number;
}

/** Même client quelle que soit la façon d'écrire le numéro : 0555…, +213 555…, 00213 555… */
export function normalizeTel(tel: string) {
  const digits = tel.replace(/\D/g, '');
  const local = digits.replace(/^(00)?213/, '');
  return local.startsWith('0') ? local : `0${local}`;
}

export const validTel = (tel: string) => /^0\d{8,9}$/.test(normalizeTel(tel));

export const pointsFor = (amount: number, every: number) => (every > 0 ? Math.floor(Math.max(0, amount) / every) : 0);

/** Avancement vers le cadeau, de 0 à 100. */
export const loyaltyProgress = (points: number, goal: number) => (goal > 0 ? Math.min(100, Math.round((points / goal) * 100)) : 0);
