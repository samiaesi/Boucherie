import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Cart } from '../core/cart';
import { DEFAULT_WEIGHTS, Product, availableOrigins, formatNumber, isOutOfStock, noOriginLeft } from '../core/data';
import { Favorites } from '../core/favorites';
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
        @if (product().oldPrice) { <span class="fat-tag promo-tag">-{{ product().promoPercent }}%</span> }
        @if (product().special) { <span class="fat-tag">{{ i18n.t('specialTag') }}</span> }
        @else if (i18n.fat(product()); as fat) { <span class="fat-tag">{{ fat }}</span> }
        @if (product().image) {
          <img [src]="product().image" [alt]="i18n.pick(product(), 'name')" loading="lazy">
        } @else {
          <span class="card-icon" [innerHTML]="icon() | icon"></span>
        }
      </a>
      <button type="button" class="fav" [class.on]="favorites.has(product().id)" [attr.aria-pressed]="favorites.has(product().id)" [attr.aria-label]="i18n.t(favorites.has(product().id) ? 'favRemove' : 'favAdd')" (click)="favorites.toggle(product().id)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.3 3.8 4.5 6.9 4.5c2 0 3.7 1.1 5.1 3 1.4-1.9 3.1-3 5.1-3 3.1 0 5.4 2.8 4.2 6.3C19.5 15.4 12 20 12 20z" /></svg></button>
      <div class="card-body">
        <a [routerLink]="['/produit', product().id]"><h3>{{ i18n.pick(product(), 'name') }}</h3></a>
        @if (countries().length; as n) {
          <div class="origins" [attr.title]="names()">
            <span class="origin-word">{{ i18n.t('origin') }}</span>
            @for (c of countries(); track c.name) {
              @if (c.flag) { <img [src]="c.flag" [alt]="c.name" width="24" height="16"> }
            }
            @if (n === 1) { <span>{{ countries()[0].name }}</span> }
          </div>
        }
        <div class="card-more"><div>
          <p>{{ i18n.pick(product(), 'desc') }}</p>
          @if (quick().length) {
            <div class="card-weights">
              @for (w of quick(); track w) {
                <button type="button" [class.on]="grams() === w" [attr.aria-pressed]="grams() === w" (click)="pickWeight(w)">{{ i18n.weight(w) }}</button>
              }
            </div>
          }
        </div></div>
        <div class="card-foot">
          @for (t of [priceText()]; track t) {
            <span class="price-tag">@if (product().oldPrice && !grams()) { <s>{{ formatOld(product().oldPrice!) }}</s> }{{ t }}</span>
          }
          <button class="add" [class.off]="out()" [class.done]="added()" (click)="quickAdd($event)" [attr.aria-label]="i18n.t('quickAdd')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="added() ? 'M5 12.5l4.5 4.5L19 7.5' : 'M12 5v14M5 12h14'" /></svg>
            <span class="add-text">{{ i18n.t('addShort') }}</span>
          </button>
        </div>
      </div>
    </article>
  `,
})
export class ProductCard {
  protected readonly i18n = inject(I18n);
  private readonly shop = inject(Shop);
  protected readonly favorites = inject(Favorites);
  private readonly cart = inject(Cart);
  private readonly router = inject(Router);
  readonly product = input.required<Product>();
  protected readonly out = computed(() => isOutOfStock(this.product()) || noOriginLeft(this.product()));
  protected readonly icon = computed(() => this.shop.category(this.product().category)?.icon);
  protected readonly countries = computed(() => this.i18n.countries(this.product()));
  /** Noms des pays au survol, quand la carte n'en montre que le nombre */
  protected readonly names = computed(() => this.countries().map(c => c.name).join(', '));
  /** Poids choisi directement sur la carte */
  protected readonly grams = signal(0);
  protected readonly added = signal(false);
  private addedTimer?: ReturnType<typeof setTimeout>;
  /** Poids rapides : seulement quand le prix ne dépend d'aucun autre choix */
  protected readonly quick = computed(() => {
    const p = this.product();
    if (p.unit !== 'kg' || !p.price || p.custom || this.out() || availableOrigins(p).length > 1) return [];
    return (p.weights?.length ? p.weights : DEFAULT_WEIGHTS).slice(0, 3);
  });
  protected readonly priceText = computed(() => {
    const p = this.product(), g = this.grams();
    if (!g) return this.i18n.price(p);
    return this.i18n.money(Math.round(((availableOrigins(p)[0]?.price ?? p.price) * g) / 1000));
  });

  protected formatOld(price: number) {
    return formatNumber(price);
  }

  protected pickWeight(w: number) {
    this.grams.update(g => (g === w ? 0 : w));
  }

  /** Ajout direct avec le premier poids et la première découpe proposés */
  protected quickAdd(e: Event) {
    const p = this.product();
    if (this.out()) {
      this.cart.warn(`${this.i18n.pick(p, 'name')} : ${this.i18n.comeback(p)}`);
      return;
    }
    const origins = availableOrigins(p);
    clearTimeout(this.addedTimer);
    // Plusieurs pays ou personnalisation : le client choisit sur la page du produit
    if (origins.length > 1 || p.custom || p.unit === 'order' || !p.price) {
      this.router.navigate(['/produit', p.id]);
      return;
    }
    const card = (e.currentTarget as HTMLElement).closest('.card');
    const thumb = card?.querySelector<HTMLElement>('.card-img img, .card-icon') ?? undefined;
    this.cart.add({
      productId: p.id, name_fr: p.name_fr, name_ar: p.name_ar, unit: p.unit, price: origins[0]?.price ?? p.price, qty: 1,
      ...(p.special ? { special: true } : {}),
      ...(origins[0] ? { origin: origins[0].country } : {}),
      grams: p.unit === 'kg' ? this.grams() || (p.weights?.length ? p.weights : DEFAULT_WEIGHTS)[0] : undefined,
      option_fr: p.options_fr?.[0], option_ar: p.options_ar?.[0] ?? p.options_fr?.[0],
    }, this.i18n.pick(p, 'name'), thumb);
    this.added.set(true);
    this.addedTimer = setTimeout(() => this.added.set(false), 1400);
  }
}
