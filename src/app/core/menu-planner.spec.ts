import { DEFAULT_CUSTOM, Product } from './data';
import { planMenus } from './menu-planner';

const kg = (id: string, price: number, extra: Partial<Product> = {}): Product => ({
  id, category: 'x', order: 1, available: true, unit: 'kg', price, name_fr: id, name_ar: id, desc_fr: '', desc_ar: '', ...extra,
});

const farci = (price = 0, meat = 0): Product => kg('poulet-farci', price, {
  unit: 'order', special: true,
  custom: { ...DEFAULT_CUSTOM, meats: DEFAULT_CUSTOM.meats.map(m => ({ ...m, price: meat })) },
});

const catalogue = [
  farci(1500, 1000), kg('filet-merlu', 1600), kg('macedoine', 450),
  kg('boeuf-couscous', 2400), kg('haricots-verts', 500), kg('cotelettes-agneau', 3200), kg('merguez', 1800),
];

describe('Proposition de menu', () => {
  it('compte deux poulets farcis pour sept personnes', () => {
    const menu = planMenus(catalogue, { guests: 7, budget: 0, style: 'fete' }).find(m => m.id === 'poulet-farci')!;
    expect(menu.lines[0]).toMatchObject({ productId: 'poulet-farci', qty: 2, unit: 'piece', special: true });
    expect(menu.total).toBe(2 * (1500 + 500));
  });

  it('calcule le poids selon le nombre de personnes', () => {
    const menu = planMenus(catalogue, { guests: 4, budget: 0, style: 'simple' }).find(m => m.id === 'poisson')!;
    expect(menu.lines.map(l => l.grams)).toEqual([800, 600]);
    expect(menu.total).toBe(1280 + 270);
  });

  it('met les olives dans le poulet farci simple', () => {
    const menu = planMenus(catalogue, { guests: 4, budget: 0, style: 'simple' }).find(m => m.id === 'poulet-olives')!;
    expect(menu.lines[0].option_fr).toContain('Olives');
  });

  it('respecte le budget', () => {
    const menus = planMenus(catalogue, { guests: 4, budget: 2200, style: 'all' });
    expect(menus.length).toBeGreaterThan(0);
    expect(menus.every(m => m.total <= 2200)).toBe(true);
  });

  it('propose le moins cher si rien ne tient dans le budget', () => {
    const menus = planMenus(catalogue, { guests: 4, budget: 100, style: 'all' });
    expect(menus).toHaveLength(1);
    expect(menus[0].over).toBe(true);
  });

  it('écarte un plat épuisé, masqué ou avec un stock trop court', () => {
    const list = [kg('filet-merlu', 1600, { trackStock: true, stock: 1 }), kg('macedoine', 450), kg('boeuf-couscous', 2400, { available: false }), kg('haricots-verts', 500)];
    expect(planMenus(list, { guests: 10, budget: 0, style: 'simple' })).toEqual([]);
    expect(planMenus(list, { guests: 4, budget: 0, style: 'simple' }).map(m => m.id)).toEqual(['poisson']);
  });

  it('signale un prix à confirmer et le classe après les prix connus', () => {
    const menus = planMenus([farci(), kg('filet-merlu', 1600), kg('macedoine', 450)], { guests: 4, budget: 0, style: 'simple' });
    expect(menus.map(m => m.id)).toEqual(['poisson', 'poulet-olives']);
    expect(menus[1]).toMatchObject({ pending: true, total: 0 });
    expect(menus[1].lines[0].unit).toBe('order');
  });

  it('garde la dinde pour les grandes tables', () => {
    const dinde = kg('dinde-farcie', 0, { unit: 'order', special: true });
    expect(planMenus([dinde], { guests: 4, budget: 0, style: 'fete' })).toEqual([]);
    expect(planMenus([dinde], { guests: 8, budget: 0, style: 'fete' })[0].id).toBe('dinde-farcie');
  });
});
