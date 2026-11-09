import { CartLine } from './cart';
import { Product, availableOrigins, isOutOfStock } from './data';

/** Un produit de la recette : en grammes pour la vente au kg, en pièces sinon */
export interface RecipeItem { product: string; grams?: number; qty?: number }

export interface Recipe {
  id: string;
  name_fr: string;
  name_ar: string;
  /** Une étape par ligne */
  steps_fr: string;
  steps_ar: string;
  minutes: number;
  serves: number;
  items: RecipeItem[];
  hidden?: boolean;
}

export const DEFAULT_RECIPES: Recipe[] = [
  {
    id: 'gigot-four', name_fr: 'Gigot d\'agneau au four', name_ar: 'فخذ خروف في الفرن', minutes: 150, serves: 6,
    items: [{ product: 'gigot-agneau', grams: 2000 }],
    steps_fr: 'Sortez le gigot du frigo 1 h avant.\nPiquez-le d\'ail, frottez-le d\'huile d\'olive, sel, poivre, cumin et romarin.\nEnfournez 15 min à 220 °C, puis 1 h 30 à 170 °C en arrosant avec le jus.\nLaissez reposer 15 min sous une feuille d\'aluminium avant de trancher.',
    steps_ar: 'أخرج الفخذ من الثلاجة قبل ساعة.\nضع فيه الثوم وادهنه بزيت الزيتون والملح والفلفل والكمون وإكليل الجبل.\nاطهه 15 دقيقة على 220 درجة ثم ساعة ونصف على 170 درجة مع سقيه بالمرق.\nاتركه يرتاح 15 دقيقة تحت ورق الألمنيوم قبل التقطيع.',
  },
  {
    id: 'tajine-pruneaux', name_fr: 'Tajine d\'agneau aux pruneaux', name_ar: 'طاجين لحم الغنم بالبرقوق', minutes: 120, serves: 6,
    items: [{ product: 'epaule-agneau', grams: 1500 }],
    steps_fr: 'Faites revenir la viande en morceaux avec oignon, beurre, sel, poivre, cannelle et safran.\nCouvrez d\'eau et laissez mijoter 1 h 30 jusqu\'à ce que la viande soit tendre.\nFaites cuire les pruneaux à part avec un peu de sucre, de cannelle et d\'eau de fleur d\'oranger.\nServez la viande nappée de sauce, les pruneaux et des amandes grillées.',
    steps_ar: 'حمّر اللحم المقطع مع البصل والزبدة والملح والفلفل والقرفة والزعفران.\nاغمره بالماء واتركه يطهى على نار هادئة ساعة ونصف حتى ينضج.\nاطه البرقوق على حدة مع قليل من السكر والقرفة وماء الزهر.\nقدّم اللحم بالمرق مع البرقوق واللوز المحمص.',
  },
  {
    id: 'couscous-boeuf', name_fr: 'Couscous au bœuf et légumes', name_ar: 'كسكس باللحم البقري والخضر', minutes: 120, serves: 8,
    items: [{ product: 'boeuf-couscous', grams: 1500 }, { product: 'carottes', grams: 1000 }],
    steps_fr: 'Faites revenir la viande avec oignon, tomate, ras el hanout, sel et poivre.\nAjoutez de l\'eau et les pois chiches trempés, laissez cuire 1 h.\nAjoutez carottes, navets et courgettes, puis cuisez 30 min.\nCuisez la semoule à la vapeur deux fois et servez avec la viande et les légumes.',
    steps_ar: 'حمّر اللحم مع البصل والطماطم ورأس الحانوت والملح والفلفل.\nأضف الماء والحمص المنقوع واتركه يطهى ساعة.\nأضف الجزر واللفت والكوسة واتركها 30 دقيقة.\nفوّر الكسكس مرتين وقدّمه مع اللحم والخضر.',
  },
  {
    id: 'chorba', name_fr: 'Chorba frik', name_ar: 'شوربة فريك', minutes: 75, serves: 6,
    items: [{ product: 'agneau-couscous', grams: 500 }],
    steps_fr: 'Coupez la viande en petits dés et faites-la revenir avec oignon, tomate et concentré.\nAjoutez sel, poivre, paprika, cannelle et 2 litres d\'eau, laissez cuire 45 min.\nVersez le frik rincé et laissez cuire 20 min en remuant.\nTerminez avec coriandre fraîche et un filet de citron.',
    steps_ar: 'قطّع اللحم مكعبات صغيرة وحمّره مع البصل والطماطم والمعجون.\nأضف الملح والفلفل والفلفل الأحمر والقرفة ولترين من الماء واتركها 45 دقيقة.\nأضف الفريك المغسول واتركه 20 دقيقة مع التحريك.\nزيّن بالقصبر الطازج وقطرات من الليمون.',
  },
  {
    id: 'poulet-roti', name_fr: 'Poulet rôti au citron', name_ar: 'دجاج محمر بالليمون', minutes: 90, serves: 4,
    items: [{ product: 'poulet-entier', grams: 1500 }],
    steps_fr: 'Badigeonnez le poulet d\'huile, ail écrasé, sel, poivre, paprika et jus de citron.\nGlissez des quartiers de citron et de l\'ail à l\'intérieur.\nEnfournez 1 h 15 à 200 °C en l\'arrosant toutes les 20 min.\nServez avec des pommes de terre rôties.',
    steps_ar: 'ادهن الدجاجة بالزيت والثوم المهروس والملح والفلفل والفلفل الأحمر وعصير الليمون.\nضع داخلها قطع الليمون والثوم.\nاطهها ساعة وربع على 200 درجة مع سقيها كل 20 دقيقة.\nقدّمها مع البطاطا المحمرة.',
  },
  {
    id: 'grillades', name_fr: 'Brochettes et kefta grillées', name_ar: 'أسياخ وكفتة مشوية', minutes: 30, serves: 6,
    items: [{ product: 'brochettes-agneau', grams: 1000 }, { product: 'kefta', grams: 1000 }],
    steps_fr: 'Allumez le barbecue 30 min avant : les braises doivent être blanches.\nGrillez les brochettes 8 à 10 min en les retournant souvent.\nGrillez la kefta 6 à 8 min.\nServez avec salade, frites et une sauce harissa.',
    steps_ar: 'أشعل الشواية قبل 30 دقيقة حتى يصبح الجمر أبيض.\nاشوِ الأسياخ 8 إلى 10 دقائق مع تقليبها.\nاشوِ الكفتة 6 إلى 8 دقائق.\nقدّمها مع السلطة والبطاطا المقلية والهريسة.',
  },
  {
    id: 'haricots-viande', name_fr: 'Haricots verts à la viande hachée', name_ar: 'لوبيا خضراء باللحم المفروم', minutes: 45, serves: 4,
    items: [{ product: 'hache-boeuf', grams: 500 }, { product: 'haricots-verts', grams: 1000 }],
    steps_fr: 'Faites revenir la viande hachée avec oignon, ail, sel, poivre et paprika.\nAjoutez tomate râpée et un peu d\'eau, laissez mijoter 10 min.\nAjoutez les haricots verts et cuisez 20 min à couvert.\nParsemez de persil avant de servir.',
    steps_ar: 'حمّر اللحم المفروم مع البصل والثوم والملح والفلفل والفلفل الأحمر.\nأضف الطماطم المبشورة وقليلا من الماء واتركه 10 دقائق.\nأضف اللوبيا الخضراء واطهها 20 دقيقة مغطاة.\nرش البقدونس قبل التقديم.',
  },
];

/** Recettes visibles qui utilisent ce produit */
export const recipesWith = (recipes: Recipe[], productId: string) =>
  recipes.filter(r => !r.hidden && r.items.some(i => i.product === productId));

/** Lignes de panier pour faire la recette ; les produits épuisés ou retirés sont laissés de côté. */
export function recipeLines(r: Recipe, products: Product[]): Omit<CartLine, 'key'>[] {
  return r.items.flatMap(i => {
    const p = products.find(x => x.id === i.product);
    if (!p || !p.available || isOutOfStock(p) || p.unit === 'order') return [];
    const origin = availableOrigins(p)[0];
    return [{
      productId: p.id, name_fr: p.name_fr, name_ar: p.name_ar, unit: p.unit, price: origin?.price ?? p.price,
      ...(origin ? { origin: origin.country } : {}),
      ...(p.unit === 'kg' ? { grams: i.grams ?? 1000, qty: 1 } : { qty: i.qty ?? 1 }),
      option_fr: p.options_fr?.[0], option_ar: p.options_ar?.[0] ?? p.options_fr?.[0],
    }];
  });
}
