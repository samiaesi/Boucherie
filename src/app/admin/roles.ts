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
  { path: 'ventes', label: 'Ventes par produit', group: 'Pilotage', roles: MANAGERS,
    icon: 'M4 20h16M7 20v-7M12 20V6M17 20v-10' },
  { path: 'rapport', label: 'Rapport du jour', group: 'Pilotage', roles: MANAGERS,
    icon: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6' },
  { path: 'commandes', label: 'Commandes', group: 'Ventes', roles: EVERYONE,
    icon: 'M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2' },
  { path: 'factures', label: 'Factures', group: 'Ventes', roles: EVERYONE,
    icon: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6' },
  { path: 'planning', label: 'Planning', group: 'Ventes', roles: EVERYONE,
    icon: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4M8 14h3M13 14h3M8 17h3' },
  { path: 'etiquettes', label: 'Étiquettes', group: 'Ventes', roles: EVERYONE,
    icon: 'M4 6v12M7 6v12M11 6v12M14 6v12M17 6v12M20 6v12' },
  { path: 'annonces', label: 'Annonces clients', group: 'Ventes', roles: MANAGERS,
    icon: 'M4 10v4h3l9 5V5l-9 5zM19 9a4 4 0 0 1 0 6M7 14v5h3v-3.5' },
  { path: 'reservations', label: 'Réservations', group: 'Ventes', roles: ADMINS,
    icon: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4M9 15l2 2 4-4' },
  { path: 'fidelite', label: 'Fidélité', group: 'Ventes', roles: MANAGERS,
    icon: 'M12 3l2.7 5.6 6.1.8-4.5 4.2 1.2 6.1L12 16.8l-5.5 2.9 1.2-6.1L3.2 9.4l6.1-.8z' },
  { path: 'pro', label: 'Entreprises', group: 'Ventes', roles: MANAGERS,
    icon: 'M4 21V7l8-4v18M12 9l8 3v9M3 21h18M8 9v.01M8 13v.01M8 17v.01M16 14v.01M16 18v.01' },
  { path: 'declaration', label: 'Déclaration', group: 'Ventes', roles: MANAGERS,
    icon: 'M5 4h14v16H5zM5 9h14M10 9v11M14 13h2M14 16h2' },
  { path: 'chaine', label: 'Chaîne du stock', group: 'Stock et catalogue', roles: MANAGERS,
    icon: 'M3 12h4l2-5 3 10 2-5h7M3 5v14M21 5v14' },
  { path: 'arrivages', label: 'Arrivages', group: 'Stock et catalogue', roles: MANAGERS,
    icon: 'M3 7h11v10H3zM14 10h4l3 3v4h-7zM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
  { path: 'stock', label: 'Stock', group: 'Stock et catalogue', roles: MANAGERS,
    icon: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9' },
  { path: 'frigo', label: 'Frigo', group: 'Stock et catalogue', roles: MANAGERS,
    icon: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM6 10h12M9 6v2M9 13v3' },
  { path: 'decoupe', label: 'Découpe', group: 'Stock et catalogue', roles: MANAGERS,
    icon: 'M10.2 13.8L20.6 3.4C21.8 6.4 20.3 10 16.7 13.6L13.4 16.9ZM9.4 14.4L11.6 16.6L5.6 22.6C5 23.2 4 23.2 3.4 22.6C2.8 22 2.8 21 3.4 20.4ZM6.9 19.2h.01' },
  { path: 'inventaire', label: 'Inventaire du soir', group: 'Stock et catalogue', roles: MANAGERS,
    icon: 'M9 4h6v3H9zM7 5.5H5.5V21h13V5.5H17M9 12l1.5 1.5L13 11M9 17h6' },
  { path: 'destockage', label: 'Déstockage', group: 'Stock et catalogue', roles: MANAGERS,
    icon: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6' },
  { path: 'produits', label: 'Produits', group: 'Stock et catalogue', roles: MANAGERS,
    icon: 'M3 12V4h8l10 10-8 8zM7.5 7.5v.01' },
  { path: 'menus', label: 'Menus proposés', group: 'Stock et catalogue', roles: ADMINS,
    icon: 'M6 3v8a2 2 0 0 0 4 0V3M8 3v18M17 3c-2 2-3 5-3 8h3zM17 3v18' },
  { path: 'rayons', label: 'Rayons', group: 'Stock et catalogue', roles: ADMINS,
    icon: 'M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z' },
  { path: 'notre-boucherie', label: 'Notre boucherie', group: 'Administration', roles: ADMINS,
    icon: 'M4 10l1.5-5h13L20 10M4 10v10h16V10M4 10h16M10 20v-5h4v5' },
  { path: 'horaires', label: 'Horaires et commandes', group: 'Administration', roles: ADMINS,
    icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2' },
  { path: 'audit', label: 'Rapport d\'audit', group: 'Administration', roles: ADMINS,
    icon: 'M9 3h6l1 2h3v16H5V5h3zM9 3v3h6V3M9 12l2 2 4-4M9 17h6' },
  { path: 'parametres', label: 'Paramètres', group: 'Administration', roles: ADMINS,
    icon: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4' },
  { path: 'equipe', label: 'Équipe', group: 'Administration', roles: ADMINS,
    icon: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c1.8.8 3 2.8 3 5.5' },
];

/** Supprimer une commande ou une facture : firestore.rules applique le même droit. */
export const canDelete = (role: Role | null) => role === 'admin' || role === 'manager';

export const canOpen = (role: Role | null, path: string) =>
  !!role && !!PAGES.find(p => p.path === path)?.roles.includes(role);

export const pagesFor = (role: Role | null) => PAGES.filter(p => role && p.roles.includes(role));

/** Pages regroupées par thème, dans l'ordre du menu */
export function menuFor(role: Role | null) {
  const groups = new Map<string, Page[]>();
  for (const p of pagesFor(role)) groups.set(p.group, [...(groups.get(p.group) ?? []), p]);
  return [...groups].map(([name, pages]) => ({ name, pages }));
}
