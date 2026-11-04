import { provideRouter } from '@angular/router';
import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Cart } from '../core/cart';
import { Product } from '../core/data';
import { I18n } from '../core/i18n';
import { ProductCard } from './product-card';

const product = (over: Partial<Product>): Product => ({
  id: 'kefta', category: 'preparations', order: 1, available: true, price: 2200, unit: 'kg',
  name_fr: 'Kefta', name_ar: 'كفتة', desc_fr: '', desc_ar: '', trackStock: true, stock: 0, ...over,
});

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (n: number) => iso(new Date(Date.now() + n * 86400000));

describe('Produit épuisé', () => {
  let i18n: I18n;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    i18n = TestBed.inject(I18n);
  });

  it('annonce le jour de retour au client', () => {
    const text = i18n.comeback(product({ restockDate: '2099-11-06' }));
    expect(text).toContain('De retour');
    expect(text).toContain('6 novembre');
  });

  it('dit « bientôt » sans date, ou si la date est passée', () => {
    expect(i18n.comeback(product({}))).toBe('Bientôt de retour');
    expect(i18n.comeback(product({ restockDate: inDays(-2) }))).toBe('Bientôt de retour');
  });

  it('accepte une date de retour aujourd\'hui', () => {
    expect(i18n.comeback(product({ restockDate: inDays(0) }))).toContain('De retour');
  });

  it('prévient le client et n\'ajoute rien au panier', async () => {
    const fixture = TestBed.createComponent(ProductCard);
    (fixture.componentRef as ComponentRef<ProductCard>).setInput('product', product({ restockDate: '2099-11-06' }));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.sold-out')?.textContent).toContain('6 novembre');

    (el.querySelector('.add') as HTMLButtonElement).click();
    const cart = TestBed.inject(Cart);
    expect(cart.lines()).toEqual([]);
    expect(cart.warning()).toContain('Kefta');
    expect(cart.warning()).toContain('6 novembre');
  });
});
