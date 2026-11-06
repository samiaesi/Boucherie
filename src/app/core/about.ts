export type EngagementKind = 'engagement' | 'environnement' | 'sante';

export const ENGAGEMENT_KINDS: Record<EngagementKind, { fr: string; ar: string; icon: string }> = {
  engagement: { fr: 'Notre engagement', ar: 'التزامنا', icon: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4' },
  environnement: { fr: 'Environnement', ar: 'البيئة', icon: 'M5 19C5 10 11 5 20 4c0 9-5 15-13 15M5 19c2-5 5-8 9-10' },
  sante: { fr: 'Santé et hygiène', ar: 'الصحة والنظافة', icon: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11zM12 9v6M9 12h6' },
};

export interface Engagement {
  kind: EngagementKind;
  title_fr: string;
  title_ar: string;
  text_fr: string;
  text_ar: string;
}

/** Certificat réel saisi par la boucherie, avec son document. */
export interface Certificate {
  id: string;
  name_fr: string;
  name_ar: string;
  /** Organisme qui l'a délivré */
  issuer: string;
  number: string;
  /** Date d'expiration AAAA-MM-JJ, vide si le document n'en a pas */
  expires: string;
  /** Photo ou scan du document */
  image: string;
}

/** Texte léger, lu à chaque visite. Les images restent dans leurs propres documents. */
export interface AboutInfo {
  engagements: Engagement[];
  photos: number;
  certificates: number;
}

export const DEFAULT_ABOUT: AboutInfo = { engagements: [], photos: 0, certificates: 0 };

/** Un document Firestore est limité à 1 Mo : ces limites gardent les images dans cette taille. */
export const MAX_PHOTOS = 6;
export const MAX_CERTIFICATES = 4;
export const PHOTO_BYTES = 150_000;
export const CERTIFICATE_BYTES = 200_000;

/** Un certificat expiré n'est jamais présenté aux clients. */
export const validCertificates = (list: Certificate[], today: string) => list.filter(c => !c.expires || c.expires >= today);

export const hasAboutContent = (a: AboutInfo) => a.engagements.length > 0 || a.photos > 0 || a.certificates > 0;

export const emptyEngagement = (kind: EngagementKind = 'engagement'): Engagement => ({ kind, title_fr: '', title_ar: '', text_fr: '', text_ar: '' });
