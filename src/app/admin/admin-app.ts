/**
 * L'admin s'installe comme sa propre application (« Hallem Admin »), seulement depuis son adresse
 * hallem-admin.web.app : sur l'adresse des clients, le téléphone confondrait les deux applications.
 */
export function useAdminApp() {
  if (location.hostname !== 'hallem-admin.web.app') return;
  const set = (selector: string, attr: 'href' | 'content', value: string) => document.querySelector(selector)?.setAttribute(attr, value);
  set('link[rel=manifest]', 'href', 'admin.webmanifest');
  set('link[rel=apple-touch-icon]', 'href', 'icons/admin-192.png');
  set('meta[name=theme-color]', 'content', '#1d1613');
  if (!document.querySelector('meta[name=apple-mobile-web-app-title]')) {
    const title = document.createElement('meta');
    title.name = 'apple-mobile-web-app-title';
    title.content = 'Hallem Admin';
    document.head.appendChild(title);
  }
}

/** Adresse de la boutique pour les liens envoyés aux clients (facture, suivi, annonces), même depuis l'adresse admin */
export const shopOrigin = () => (location.hostname === 'hallem-admin.web.app' ? 'https://boucherie-hallem.web.app' : location.origin);
