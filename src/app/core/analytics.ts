import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Analytics, initializeAnalytics, isSupported, logEvent, setAnalyticsCollectionEnabled } from 'firebase/analytics';
import { firebaseApp } from './firebase';

/** Les adresses de factures et de suivi sont secrètes, et l'admin ne compte pas comme une visite. */
const PRIVATE_PAGE = /^\/(admin|facture|suivi)(\/|$)/;

/** Adresse sans paramètres, ou null pour une page à ne jamais compter. */
export function publicPath(url: string) {
  const path = url.split(/[?#]/)[0] || '/';
  return PRIVATE_PAGE.test(path) ? null : path;
}

/**
 * Compte les visites du site public. Google n'est chargé qu'à la première page publique,
 * et la collecte est coupée avant d'entrer sur une page privée.
 */
export async function startVisitStats(router: Router) {
  if (!(await isSupported())) return;
  let stats: Analytics | null = null;

  const pageView = (url: string) => {
    const path = publicPath(url);
    if (!path) return;
    stats ??= initializeAnalytics(firebaseApp, { config: { send_page_view: false } });
    setAnalyticsCollectionEnabled(stats, true);
    logEvent(stats, 'page_view', { page_path: path, page_location: `${location.origin}${path}`, page_title: document.title });
  };

  router.events.subscribe(e => {
    if (e instanceof NavigationStart && stats && !publicPath(e.url)) setAnalyticsCollectionEnabled(stats, false);
    if (e instanceof NavigationEnd) pageView(e.urlAfterRedirects);
  });
  if (router.navigated) pageView(router.url);
}
