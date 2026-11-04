import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
        <div class="shop-layout">
        <aside class="rayons">
          <h2>{{ i18n.t('catEyebrow') }}</h2>
          <a class="rayon" routerLink="/boutique" [class.on]="!cat()">
            <span>{{ i18n.t('all') }}</span><small>{{ shop.products().length }}</small>
          </a>
          @for (c of shop.categories(); track c.id) {
            <a class="rayon" routerLink="/boutique" [queryParams]="{ cat: c.id }" [class.on]="cat() === c.id">
              <i [innerHTML]="c.icon | icon"></i>
              <span>{{ i18n.pick(c, 'name') }}</span>
              <small>{{ countIn(c.id) }}</small>
            </a>
          }
        </aside>

        <div class="shop-main">
        <div class="filters">
          <select class="rayon-select" [attr.aria-label]="i18n.t('catEyebrow')" (change)="goTo($any($event.target).value)">
            <option value="" [selected]="!cat()">{{ i18n.t('all') }} ({{ shop.products().length }})</option>
            @for (c of shop.categories(); track c.id) {
              <option [value]="c.id" [selected]="cat() === c.id">{{ i18n.pick(c, 'name') }} ({{ countIn(c.id) }})</option>
            }
          </select>
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
        </div>
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

  private readonly router = inject(Router);

  protected countIn(category: string) {
    return this.shop.products().filter(p => p.category === category).length;
  }

  protected goTo(cat: string) {
    this.router.navigate(['/boutique'], { queryParams: cat ? { cat } : {} });
  }

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
