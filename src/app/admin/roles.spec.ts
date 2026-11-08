import { canDelete, canOpen, menuFor, pagesFor } from './roles';

describe('Menu selon le rôle', () => {
  it('donne tout à l\'administrateur, groupé par thème', () => {
    const menu = menuFor('admin');
    expect(menu.map(g => g.name)).toEqual(['Pilotage', 'Ventes', 'Stock et catalogue', 'Administration']);
    expect(menu.flatMap(g => g.pages)).toHaveLength(26);
  });

  it('cache l\'administration au manager', () => {
    expect(canOpen('manager', 'stock')).toBe(true);
    expect(canOpen('manager', 'equipe')).toBe(false);
    expect(menuFor('manager').map(g => g.name)).not.toContain('Administration');
  });

  it('limite le suivi aux commandes, factures et étiquettes', () => {
    expect(pagesFor('commandes').map(p => p.path)).toEqual(['commandes', 'factures', 'planning', 'etiquettes']);
  });

  it('refuse tout sans rôle', () => {
    expect(canOpen(null, 'commandes')).toBe(false);
    expect(menuFor(null)).toEqual([]);
  });
});

describe('Suppression', () => {
  it('est réservée à l\'administrateur et au manager', () => {
    expect(canDelete('admin')).toBe(true);
    expect(canDelete('manager')).toBe(true);
    expect(canDelete('commandes')).toBe(false);
    expect(canDelete(null)).toBe(false);
  });
});
