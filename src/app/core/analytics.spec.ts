import { publicPath } from './analytics';

describe('Statistiques de visites', () => {
  it('compte les pages publiques sans leurs paramètres', () => {
    expect(publicPath('/')).toBe('/');
    expect(publicPath('/boutique?cat=poulet')).toBe('/boutique');
    expect(publicPath('/produit/gigot#avis')).toBe('/produit/gigot');
    expect(publicPath('/administration')).toBe('/administration');
  });

  it('ignore l\'admin, les factures et le suivi de commande', () => {
    for (const url of ['/admin', '/admin/stock', '/facture/abc123', '/suivi/abc123?x=1']) {
      expect(publicPath(url)).toBeNull();
    }
  });
});
