import { Lang, Order } from './data';

export type AnnouncementKind = 'arrivage' | 'remise' | 'offre';

export interface Announcement {
  id: string;
  kind: AnnouncementKind;
  title_fr: string;
  title_ar: string;
  text_fr: string;
  text_ar: string;
  /** AAAA-MM-JJ, premier et dernier jour d'affichage */
  start: string;
  end: string;
}

export const KIND_LABELS: Record<AnnouncementKind, { fr: string; ar: string; icon: string }> = {
  arrivage: { fr: 'Nouvel arrivage', ar: 'وصول جديد', icon: '🚚' },
  remise: { fr: 'Remise', ar: 'تخفيض', icon: '🏷️' },
  offre: { fr: 'Offre du jour', ar: 'عرض اليوم', icon: '🎁' },
};

/** Annonces à afficher ce jour-là, les plus récentes d'abord. */
export const liveAnnouncements = (list: Announcement[], today: string) =>
  list.filter(a => a.start <= today && today <= a.end).sort((a, b) => b.start.localeCompare(a.start));

export interface Subscriber {
  name: string;
  tel: string;
  lang: Lang;
}

/**
 * Clients ayant accepté de recevoir les offres : un seul par numéro.
 * La commande la plus récente (en tête de liste) décide de la langue et du consentement.
 */
export function subscribers(orders: Order[]): Subscriber[] {
  const seen = new Map<string, Subscriber | null>();
  for (const o of orders) {
    if (!seen.has(o.tel)) seen.set(o.tel, o.marketing ? { name: o.name, tel: o.tel, lang: o.lang } : null);
  }
  return [...seen.values()].filter((s): s is Subscriber => !!s);
}

export function announcementMessage(a: Announcement, lang: Lang, shopName: string, url: string) {
  const kind = KIND_LABELS[a.kind];
  const title = lang === 'ar' ? a.title_ar || a.title_fr : a.title_fr;
  const text = lang === 'ar' ? a.text_ar || a.text_fr : a.text_fr;
  return [`${kind.icon} ${shopName} : ${lang === 'ar' ? kind.ar : kind.fr}`, title, text, url].filter(Boolean).join('\n');
}
