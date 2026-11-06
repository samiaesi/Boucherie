import { Product, lowestPrice } from './data';

export const MAX_PROMO = 90;

/** Promotion en cours : la date de fin est incluse. Les commandes personnalisées ont leur propre calcul. */
export const promoActive = (p: Product, today: string) =>
  !!p.promoPercent && p.promoPercent > 0 && p.promoPercent <= MAX_PROMO && !!p.promoUntil && today <= p.promoUntil
  && !p.custom && p.unit !== 'order' && p.price > 0;

const reduced = (price: number, percent: number) => Math.round(price * (1 - percent / 100));

/** Prix du client : tous les pays baissent du même pourcentage, l'ancien prix reste affiché barré. */
export function applyPromos(products: Product[], today: string): Product[] {
  return products.map(p => {
    if (!promoActive(p, today)) return p;
    const percent = p.promoPercent!;
    return {
      ...p, oldPrice: lowestPrice(p), price: reduced(p.price, percent),
      ...(p.origins ? { origins: p.origins.map(o => ({ ...o, price: reduced(o.price, percent) })) } : {}),
    };
  });
}

/** Secondes avant la fin du dernier jour de promotion, à l'heure d'Algérie. */
export const secondsLeft = (until: string, now: Date) =>
  Math.max(0, Math.floor((Date.parse(`${until}T23:59:59+01:00`) - now.getTime()) / 1000));

/** « 2 j 03:14:09 » ou « 03:14:09 » */
export function countdown(seconds: number) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const days = Math.floor(seconds / 86400);
  const clock = `${pad(Math.floor((seconds % 86400) / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
  return days ? `${days} j ${clock}` : clock;
}
