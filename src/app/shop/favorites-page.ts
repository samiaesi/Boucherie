import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Favorites } from '../core/favorites';
import { I18n } from '../core/i18n';
import { Shop } from '../core/shop';
import { ProductCard } from './product-card';

@Component({
  selector: 'app-favorites-page',
  imports: [RouterLink, ProductCard],
  template: `
    <section class="page-head"><div class="wrap"><h1>{{ i18n.t('favTitle') }}</h1><p>{{ i18n.t('favLead') }}</p></div></section>
    <section class="products">
      <div class="wrap">
        <div class="grid">
          @for (p of products(); track p.id) { <app-product-card [product]="p" /> }
        </div>
        @if (!products().length) {
          <p class="empty">{{ i18n.t('favEmpty') }}</p>
          <div class="plan-more"><a routerLink="/boutique" class="btn btn-red">{{ i18n.t('seeAll') }}</a></div>
        }
      </div>
    </section>
  `,
})
export class FavoritesPage {
  protected readonly i18n = inject(I18n);
  private readonly shop = inject(Shop);
  private readonly favorites = inject(Favorites);
  /** Un favori retiré du catalogue disparaît simplement de la liste */
  protected readonly products = computed(() => this.favorites.ids()
    .map(id => this.shop.products().find(p => p.id === id))
    .filter(p => !!p));
}
