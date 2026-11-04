import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n } from '../core/i18n';
import { IconPipe } from '../core/icon';
import { Shop } from '../core/shop';
import { ProductCard } from './product-card';

@Component({
  selector: 'app-catalog',
  imports: [RouterLink, IconPipe, ProductCard],
  template: `
    <section class="page-head">
      <div class="wrap">
        <h1>{{ title() }}</h1>
        <p>{{ i18n.t('shopText') }}</p>
      </div>
    </section>

    <section class="shop">
      <div class="wrap">
        <div class="pills">
          <a class="pill" routerLink="/boutique" [class.on]="!cat()">{{ i18n.t('all') }}</a>
          @for (c of shop.categories(); track c.id) {
            <a class="pill" routerLink="/boutique" [queryParams]="{ cat: c.id }" [class.on]="cat() === c.id">
              <span [innerHTML]="c.icon | icon"></span>{{ i18n.pick(c, 'name') }}
            </a>
          }
        </div>

        <div class="filters">
          <input type="search" [placeholder]="i18n.t('search')" [value]="query()" (input)="query.set($any($event.target).value)">
          <select (change)="sort.set($any($event.target).value)">
            <option value="">{{ i18n.t('sortDefault') }}</option>
            <option value="asc">{{ i18n.t('sortAsc') }}</option>
            <option value="desc">{{ i18n.t('sortDesc') }}</option>
          </select>
        </div>

        @for (key of [cat() ?? 'tout']; track key) {
          <div class="grid">
            @for (p of list(); track p.id; let i = $index) {
              <app-product-card class="pop" [style.--i]="i" [product]="p" />
            } @empty {
              <p class="empty">{{ i18n.t('noResult') }}</p>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class Catalog {
  protected readonly i18n = inject(I18n);
  protected readonly shop = inject(Shop);
  /** Paramètre d'URL ?cat= */
  readonly cat = input<string>();
  protected readonly query = signal('');
  protected readonly sort = signal('');

  protected readonly title = computed(() => {
    const c = this.shop.category(this.cat() ?? '');
    return c ? this.i18n.pick(c, 'name') : this.i18n.t('shopTitle');
  });

  protected readonly list = computed(() => {
    const cat = this.cat(), q = this.query().trim().toLowerCase(), sort = this.sort();
    const found = this.shop.products().filter(p =>
      (!cat || p.category === cat) &&
      (!q || `${p.name_fr} ${p.name_ar} ${p.desc_fr} ${p.desc_ar}`.toLowerCase().includes(q)));
    if (!sort) return found;
    return [...found].sort((a, b) => (sort === 'asc' ? a.price - b.price : b.price - a.price));
  });
}
