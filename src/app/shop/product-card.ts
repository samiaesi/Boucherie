import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Cart } from '../core/cart';
import { DEFAULT_WEIGHTS, Product, isOutOfStock, originsOf } from '../core/data';
import { I18n } from '../core/i18n';
import { IconPipe } from '../core/icon';
import { Shop } from '../core/shop';
import { Tilt } from './effects';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, IconPipe, Tilt],
  template: `
    <article class="card" [class.out]="out()" appTilt>
      @if (out()) { <span class="sold-out">{{ i18n.t('soldOut') }} · {{ i18n.comeback(product()) }}</span> }
      <a class="card-img" [routerLink]="['/produit', product().id]">
        @if (product().image) {
          <img [src]="product().image" [alt]="i18n.pick(product(), 'name')" loading="lazy">
        } @else {
          <span class="card-icon" [innerHTML]="icon() | icon"></span>
        }
      </a>
      <div class="card-body">
        <a [routerLink]="['/produit', product().id]"><h3>{{ i18n.pick(product(), 'name') }}</h3></a>
        @if (i18n.origin(product()); as origin) { <small class="origin">{{ origin }}</small> }
        <p>{{ i18n.pick(product(), 'desc') }}</p>
        <div class="card-foot">
          <span class="price-tag">{{ i18n.price(product()) }}</span>
          <button class="add" [class.off]="out()" (click)="quickAdd($event)" [attr.aria-label]="i18n.t('quickAdd')">+</button>
        </div>
      </div>
    </article>
  `,
})
export class ProductCard {
  protected readonly i18n = inject(I18n);
  private readonly shop = inject(Shop);
  private readonly cart = inject(Cart);
  private readonly router = inject(Router);
  readonly product = input.required<Product>();
  protected readonly out = computed(() => isOutOfStock(this.product()));
  protected readonly icon = computed(() => this.shop.category(this.product().category)?.icon);

  /** Ajout direct avec le premier poids et la première découpe proposés */
  protected quickAdd(e: Event) {
    const p = this.product();
    if (this.out()) {
      this.cart.warn(`${this.i18n.pick(p, 'name')} : ${this.i18n.comeback(p)}`);
      return;
    }
    const origins = originsOf(p);
    // Plusieurs pays : le client doit choisir sur la page du produit
    if (origins.length > 1) {
      this.router.navigate(['/produit', p.id]);
      return;
    }
    const card = (e.currentTarget as HTMLElement).closest('.card');
    const thumb = card?.querySelector<HTMLElement>('.card-img img, .card-icon') ?? undefined;
    this.cart.add({
      productId: p.id, name_fr: p.name_fr, name_ar: p.name_ar, unit: p.unit, price: origins[0]?.price ?? p.price, qty: 1,
      ...(origins[0] ? { origin: origins[0].country } : {}),
      grams: p.unit === 'kg' ? (p.weights?.length ? p.weights : DEFAULT_WEIGHTS)[0] : undefined,
      option_fr: p.options_fr?.[0], option_ar: p.options_ar?.[0] ?? p.options_fr?.[0],
    }, this.i18n.pick(p, 'name'), thumb);
  }
}
