/** Compteur d'un créneau de livraison pour un jour : « 2026-11-07_1000-1200 ». */
export const slotKey = (date: string, slot: string) => `${date}_${slot.replace(/[^0-9-]/g, '')}`;

/** Le créneau figure dans le libellé de la commande : « Livraison 10:00-12:00 · … ». */
export const slotInLabel = (label: string) => /\b(\d{2}:\d{2}-\d{2}:\d{2})\b/.exec(label)?.[1] ?? '';

export const slotFull = (count: number, max: number) => max > 0 && count >= max;

/** Une ligne par créneau, sans les lignes mal écrites. */
export const parseSlots = (text: string) => text.split('\n').map(s => s.trim().replace(/\s/g, '')).filter(s => /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(s));

/** « Arrivé aujourd'hui » : nombre de jours depuis l'arrivage, null s'il est trop ancien pour rassurer. */
export function arrivalAge(arrival: string | undefined, today: string, maxDays = 3) {
  if (!arrival) return null;
  const days = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${arrival}T12:00:00Z`)) / 86400000);
  return days >= 0 && days <= maxDays ? days : null;
}
