import { Product } from './data';

/** Ce que le client a choisi sur la page du produit */
export interface CustomPick {
  meat: number;
  grams: number;
  extras: number[];
}

/** Vrai quand tous les prix nécessaires sont saisis ; sinon le prix reste à confirmer. */
export const customReady = (p: Product) => p.price > 0 && !!p.custom?.meats.every(m => m.price > 0);

/** Prix final d'une pièce : base cachée + viande au poids + ingrédients. */
export function customTotal(p: Product, pick: CustomPick) {
  if (!customReady(p)) return null;
  const meat = p.custom!.meats[pick.meat];
  const meatPrice = meat ? (meat.price * pick.grams) / 1000 : 0;
  const extras = pick.extras.reduce((sum, i) => sum + (p.custom!.extras[i]?.price ?? 0), 0);
  return Math.round(p.price + meatPrice + extras);
}

/** Choix du client en une ligne, pour le panier, WhatsApp, la commande et la facture. */
export function customText(p: Product, pick: CustomPick, lang: 'fr' | 'ar') {
  const custom = p.custom;
  if (!custom) return '';
  const meat = custom.meats[pick.meat];
  const kg = lang === 'ar' ? 'غ' : 'g';
  const parts = [
    meat ? `${meat[lang]} ${pick.grams} ${kg}` : '',
    ...pick.extras.map(i => custom.extras[i]?.[lang] ?? ''),
  ];
  return parts.filter(Boolean).join(' · ');
}
