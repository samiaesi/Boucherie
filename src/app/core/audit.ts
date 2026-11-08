import type { DaySchedule } from './ordering';
import { Order, orderRef } from './data';

export type AuditCategory = 'Connexion' | 'Commandes' | 'Factures' | 'Stock' | 'Catalogue' | 'Clients' | 'Équipe' | 'Paramètres';

export const AUDIT_ACTIONS = {
  'login': { label: 'Connexion à l\'admin', category: 'Connexion' },
  'order.created': { label: 'Commande reçue du site', category: 'Commandes' },
  'order.status': { label: 'Changement de statut', category: 'Commandes' },
  'order.updated': { label: 'Commande modifiée', category: 'Commandes' },
  'order.deleted': { label: 'Commande supprimée', category: 'Commandes' },
  'invoice.created': { label: 'Facture entreprise émise', category: 'Factures' },
  'invoice.paid': { label: 'Paiement enregistré', category: 'Factures' },
  'invoice.cancelled': { label: 'Facture annulée', category: 'Factures' },
  'invoice.deleted': { label: 'Facture supprimée', category: 'Factures' },
  'lot.created': { label: 'Arrivage enregistré', category: 'Stock' },
  'lot.cancelled': { label: 'Arrivage annulé', category: 'Stock' },
  'exit.created': { label: 'Sortie de stock (déstockage)', category: 'Stock' },
  'exit.cancelled': { label: 'Sortie de stock annulée', category: 'Stock' },
  'fridge.updated': { label: 'Frigo modifié', category: 'Stock' },
  'stock.reset': { label: 'Stock remis à zéro', category: 'Stock' },
  'register.cleared': { label: 'Arrivages et sorties effacés', category: 'Stock' },
  'product.created': { label: 'Produit ajouté', category: 'Catalogue' },
  'product.updated': { label: 'Produit ou stock modifié', category: 'Catalogue' },
  'product.deleted': { label: 'Produit supprimé', category: 'Catalogue' },
  'offer.created': { label: 'Formule ajoutée', category: 'Catalogue' },
  'offer.updated': { label: 'Formule modifiée', category: 'Catalogue' },
  'offer.deleted': { label: 'Formule supprimée', category: 'Catalogue' },
  'categories.updated': { label: 'Rayons modifiés', category: 'Catalogue' },
  'menus.updated': { label: 'Menus proposés modifiés', category: 'Catalogue' },
  'reservations.updated': { label: 'Réservations modifiées', category: 'Catalogue' },
  'loyalty.updated': { label: 'Points de fidélité modifiés', category: 'Commandes' },
  'announcement.created': { label: 'Annonce publiée', category: 'Clients' },
  'announcement.deleted': { label: 'Annonce retirée', category: 'Clients' },
  'company.updated': { label: 'Client entreprise enregistré', category: 'Clients' },
  'company.deleted': { label: 'Client entreprise supprimé', category: 'Clients' },
  'member.created': { label: 'Membre ajouté', category: 'Équipe' },
  'member.role': { label: 'Rôle modifié', category: 'Équipe' },
  'member.deleted': { label: 'Accès retiré', category: 'Équipe' },
  'settings.updated': { label: 'Paramètres modifiés', category: 'Paramètres' },
  'ordering.updated': { label: 'Horaires ou fermeture modifiés', category: 'Paramètres' },
} as const satisfies Record<string, { label: string; category: AuditCategory }>;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export interface AuditEntry {
  id: string;
  at: Date;
  /** Vide pour une commande passée par un client sur le site */
  email: string;
  role: string;
  action: AuditAction;
  target: string;
  detail: string;
}

const MAX_DETAIL = 480;
/** Les photos sont stockées dans les documents : leur contenu n'a pas sa place dans le journal */
const IMAGE_KEY = /image/i;

const show = (v: unknown) => {
  if (v === undefined || v === null || v === '') return '—';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
};

export const trimDetail = (text: string) => (text.length > MAX_DETAIL ? `${text.slice(0, MAX_DETAIL)}…` : text);

const WEEK_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const LIST_NAMES: Record<string, string> = {
  closedSlots: 'créneaux fermés', closedDays: 'jours de fermeture', origins: 'pays et prix', custom: 'personnalisation',
  options_fr: 'découpes', options_ar: 'découpes en arabe', weights: 'poids proposés', deliveryZones: 'lieux de livraison',
};

const dayHours = (d?: DaySchedule) => (!d ? '—' : d.open ? `${d.from}–${d.to}` : 'fermé');

/** Horaires lisibles : seuls les jours modifiés apparaissent. */
function scheduleChanges(before: unknown, after: DaySchedule[]) {
  const old = Array.isArray(before) ? (before as DaySchedule[]) : [];
  return after.flatMap(day => {
    const was = old.find(d => d.day === day.day);
    return dayHours(was) === dayHours(day) ? [] : [`${WEEK_DAYS[day.day]} : ${dayHours(was)} → ${dayHours(day)}`];
  });
}

/** Ce qui a changé entre deux versions : « stock : 1000 → 0 · prix : 2600 → 2800 ». */
export function describeChanges(before: object | undefined, after: object) {
  const old = (before ?? {}) as Record<string, unknown>;
  const parts = Object.entries(after).flatMap(([key, value]) => {
    if (JSON.stringify(old[key]) === JSON.stringify(value)) return [];
    if (IMAGE_KEY.test(key)) return [`${key} : photo modifiée`];
    if (key === 'schedule' && Array.isArray(value)) return scheduleChanges(old[key], value as DaySchedule[]);
    if (value !== null && typeof value === 'object') return [`${LIST_NAMES[key] ?? key} : modifié`];
    return [`${key} : ${show(old[key])} → ${show(value)}`];
  });
  return trimDetail(parts.join(' · '));
}

/** Les commandes des clients viennent de la collection orders : le public n'écrit jamais dans le journal. */
export function orderEntries(orders: Order[]): AuditEntry[] {
  return orders.filter(o => o.createdAt).map(o => ({
    id: `order-${o.id}`, at: o.createdAt!, email: '', role: 'Client du site', action: 'order.created', target: orderRef(o.id),
    detail: trimDetail(`${o.name} · ${o.tel} · ${o.typeLabel}`),
  }));
}

export interface AuditFilter {
  category: string;
  user: string;
  text: string;
}

export const entryCategory = (e: AuditEntry): AuditCategory => AUDIT_ACTIONS[e.action]?.category ?? 'Paramètres';
export const entryLabel = (e: AuditEntry): string => AUDIT_ACTIONS[e.action]?.label ?? e.action;

export function filterEntries(entries: AuditEntry[], f: AuditFilter) {
  const q = f.text.trim().toLowerCase();
  return entries.filter(e =>
    (!f.category || entryCategory(e) === f.category)
    && (!f.user || e.email === f.user)
    && (!q || [e.email, e.target, e.detail, entryLabel(e)].some(v => v.toLowerCase().includes(q))));
}

/** Nombre d'actions par catégorie, pour le résumé du rapport. */
export function auditSummary(entries: AuditEntry[]) {
  const counts = new Map<AuditCategory, number>();
  for (const e of entries) counts.set(entryCategory(e), (counts.get(entryCategory(e)) ?? 0) + 1);
  return [...counts].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}

/** Protège Excel des formules cachées dans un nom de client. */
function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function auditCsv(entries: AuditEntry[], when: (d: Date) => string) {
  const rows = entries.map(e => [when(e.at), e.email || 'Site', e.role, entryCategory(e), entryLabel(e), e.target, e.detail]);
  const lines = [['Date', 'Utilisateur', 'Rôle', 'Catégorie', 'Action', 'Objet', 'Détail'], ...rows];
  return `﻿${lines.map(l => l.map(csvCell).join(';')).join('\r\n')}`;
}
