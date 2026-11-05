import { inject as startAnalytics } from '@vercel/analytics';

/** Les adresses de factures et de suivi sont secrètes, et l'admin ne compte pas comme une visite. */
const PRIVATE_PAGE = /^\/(admin|facture|suivi)(\/|$)/;

export const isPublicPage = (url: string) => !PRIVATE_PAGE.test(new URL(url).pathname);

/** Compte les visites du site public sur Vercel. */
export function startVisitStats() {
  startAnalytics({ mode: 'production', beforeSend: event => (isPublicPage(event.url) ? event : null) });
}
