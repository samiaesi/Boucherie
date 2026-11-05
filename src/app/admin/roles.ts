export type Role = 'admin' | 'manager' | 'commandes';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrateur',
  manager: 'Manager',
  commandes: 'Suivi des commandes',
};

const EVERYONE: Role[] = ['admin', 'manager', 'commandes'];
const MANAGERS: Role[] = ['admin', 'manager'];
const ADMINS: Role[] = ['admin'];

export interface Page {
  path: string;
  label: string;
  group: string;
  /** Tracé SVG du pictogramme (grille 24×24) */
  icon: string;
  roles: Role[];
}

/** Pages de l'admin et rôles autorisés. firestore.rules applique les mêmes droits côté serveur. */
export const PAGES: Page[] = [
  { path: 'tableau', label: 'Tableau de bord', group: 'Pilotage', roles: MANAGERS,
    icon: 'M4 13h6v7H4zM14 4h6v16h-6zM4 4h6v5H4z' },
  { path: 'rapport', label: 'Rapport du jour', group: 'Pilotage', roles: MANAGERS,
    icon: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6' },
  { path: 'commandes', label: 'Commandes', group: 'Ventes', roles: EVERYONE,
    icon: 'M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2' },
  { path: 'factures', label: 'Factures', group: 'Ventes', roles: EVERYONE,
    icon: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6' },
  { path: 'etiquettes', label: 'Étiquettes', group: 'Ventes', roles: EVERYONE,
    icon: 'M4 6v12M7 6v12M11 6v12M14 6v12M17 6v12M20 6v12' },
  { path: 'annonces', label: 'Annonces clients', group: 'Ventes', roles: MANAGERS,
    icon: 'M4 10v4h3l9 5V5l-9 5zM19 9a4 4 0 0 1 0 6M7 14v5h3v-3.5' },
  { path: 'pro', label: 'Entreprises', group: 'Ventes', roles: MANAGERS,
    icon: 'M4 21V7l8-4v18M12 9l8 3v9M3 21h18M8 9v.01M8 13v.01M8 17v.01M16 14v.01M16 18v.01' },
  { path: 'declaration', label: 'Déclaration', group: 'Ventes', roles: MANAGERS,
    icon: 'M5 4h14v16H5zM5 9h14M10 9v11M14 13h2M14 16h2' },
  { path: 'arrivages', label: 'Arrivages', group: 'Stock et catalogue', roles: MANAGERS,
    icon: 'M3 7h11v10H3zM14 10h4l3 3v4h-7zM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
  { path: 'stock', label: 'Stock', group: 'Stock et catalogue', roles: MANAGERS,
    icon: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9' },
  { path: 'frigo', label: 'Frigo', group: 'Stock et catalogue', roles: MANAGERS,
    icon: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM6 10h12M9 6v2M9 13v3' },
  { path: 'produits', label: 'Produits', group: 'Stock et catalogue', roles: MANAGERS,
    icon: 'M3 12V4h8l10 10-8 8zM7.5 7.5v.01' },
  { path: 'formules', label: 'Formules', group: 'Stock et catalogue', roles: MANAGERS,
    icon: 'M4 8h16v4H4zM6 12v9h12v-9M12 8v13M12 8S10 3 7.5 4 9 8 12 8zM12 8s2-5 4.5-4S15 8 12 8z' },
  { path: 'rayons', label: 'Rayons', group: 'Stock et catalogue', roles: ADMINS,
    icon: 'M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z' },
  { path: 'horaires', label: 'Horaires et commandes', group: 'Administration', roles: ADMINS,
    icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2' },
  { path: 'parametres', label: 'Paramètres', group: 'Administration', roles: ADMINS,
    icon: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4' },
  { path: 'equipe', label: 'Équipe', group: 'Administration', roles: ADMINS,
    icon: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c1.8.8 3 2.8 3 5.5' },
];

export const canOpen = (role: Role | null, path: string) =>
  !!role && !!PAGES.find(p => p.path === path)?.roles.includes(role);

export const pagesFor = (role: Role | null) => PAGES.filter(p => role && p.roles.includes(role));

/** Pages regroupées par thème, dans l'ordre du menu */
export function menuFor(role: Role | null) {
  const groups = new Map<string, Page[]>();
  for (const p of pagesFor(role)) groups.set(p.group, [...(groups.get(p.group) ?? []), p]);
  return [...groups].map(([name, pages]) => ({ name, pages }));
}
