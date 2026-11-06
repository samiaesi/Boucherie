import { Certificate, DEFAULT_ABOUT, hasAboutContent, validCertificates } from './about';

const cert = (expires: string) => ({ id: expires || 'x', name_fr: 'Certificat', name_ar: '', issuer: '', number: '', expires, image: '' }) as Certificate;

describe('Certificats', () => {
  it('cache un certificat expiré et garde celui sans date', () => {
    const list = validCertificates([cert('2026-11-05'), cert('2026-11-06'), cert('2027-01-01'), cert('')], '2026-11-06');
    expect(list.map(c => c.expires)).toEqual(['2026-11-06', '2027-01-01', '']);
  });
});

describe('Page Notre boucherie', () => {
  it('reste cachée tant que rien n\'est rempli', () => {
    expect(hasAboutContent(DEFAULT_ABOUT)).toBe(false);
    expect(hasAboutContent({ ...DEFAULT_ABOUT, photos: 1 })).toBe(true);
  });
});
