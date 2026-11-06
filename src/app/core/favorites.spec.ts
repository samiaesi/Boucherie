import { TestBed } from '@angular/core/testing';
import { Favorites } from './favorites';

describe('Favoris', () => {
  beforeEach(() => localStorage.removeItem('favorites'));

  it('ajoute puis retire un produit, le plus récent en tête', () => {
    const favorites = TestBed.inject(Favorites);
    favorites.toggle('a');
    favorites.toggle('b');
    expect(favorites.ids()).toEqual(['b', 'a']);
    favorites.toggle('a');
    expect(favorites.has('a')).toBe(false);
    expect(favorites.count()).toBe(1);
  });
});
