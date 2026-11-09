import { DEFAULT_PRODUCTS, Product } from './data';
import { DEFAULT_RECIPES, recipeLines, recipesWith } from './recipes';

describe('recettes', () => {
  it('chaque recette de départ utilise des produits du catalogue', () => {
    const ids = new Set(DEFAULT_PRODUCTS.map(p => p.id));
    for (const r of DEFAULT_RECIPES) for (const i of r.items) expect(ids.has(i.product), `${r.id} → ${i.product}`).toBe(true);
  });

  it('trouve les recettes d\'un produit, sans les recettes masquées', () => {
    const list = [...DEFAULT_RECIPES, { ...DEFAULT_RECIPES[0], id: 'cache', hidden: true }];
    expect(recipesWith(list, 'gigot-agneau').map(r => r.id)).toEqual(['gigot-four']);
  });

  it('met les produits de la recette au panier, sans ceux qui manquent', () => {
    const products = [
      { id: 'brochettes-agneau', name_fr: 'Brochettes', name_ar: '', unit: 'kg', price: 2000, available: true },
      { id: 'kefta', name_fr: 'Kefta', name_ar: '', unit: 'kg', price: 1500, available: true, trackStock: true, stock: 0 },
    ] as Product[];
    const lines = recipeLines(DEFAULT_RECIPES.find(r => r.id === 'grillades')!, products);
    expect(lines.map(l => [l.productId, l.grams, l.qty])).toEqual([['brochettes-agneau', 1000, 1]]);
  });
});
