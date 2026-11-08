/**
 * L'admin s'installe comme sa propre application (« Hallem Admin ») : en arrivant sur l'admin
 * depuis la boutique, on donne au navigateur le manifeste et l'icône de l'admin.
 */
export function useAdminApp() {
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
