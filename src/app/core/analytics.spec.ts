import { isPublicPage } from './analytics';

describe('Statistiques de visites', () => {
  it('compte les pages publiques', () => {
    expect(isPublicPage('https://site.test/')).toBe(true);
    expect(isPublicPage('https://site.test/boutique?cat=poulet')).toBe(true);
    expect(isPublicPage('https://site.test/administration')).toBe(true);
  });

  it('ignore l\'admin, les factures et le suivi de commande', () => {
    expect(isPublicPage('https://site.test/admin')).toBe(false);
    expect(isPublicPage('https://site.test/admin/stock')).toBe(false);
    expect(isPublicPage('https://site.test/facture/abc123')).toBe(false);
    expect(isPublicPage('https://site.test/suivi/abc123')).toBe(false);
  });
});
