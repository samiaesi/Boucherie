import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { availableOrigins, countriesIn, countryFlag, lowestPrice } from '../core/data';
import { I18n } from '../core/i18n';
import { IconPipe } from '../core/icon';
import { Shop } from '../core/shop';
import { ProductCard } from './product-card';

@Component({
  selector: 'app-catalog',
  host: { '(document:click)': 'countryOpen.set(false)' },
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
          <nav class="rayon-list" [attr.aria-label]="i18n.t('catEyebrow')">
            <span class="rayon-pill" [style.--i]="activeRayon()" aria-hidden="true"></span>
            <a class="rayon" routerLink="/boutique" [class.on]="!cat()" [attr.aria-current]="!cat() ? 'page' : null" style="--n: 0">
              <i class="all"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg></i>
              <span>{{ i18n.t('all') }}</span><small>{{ shop.products().length }}</small>
            </a>
            @for (c of shop.categories(); track c.id; let i = $index) {
              <a class="rayon" routerLink="/boutique" [queryParams]="{ cat: c.id }" [class.on]="cat() === c.id" [attr.aria-current]="cat() === c.id ? 'page' : null" [style.--n]="i + 1">
                <i [innerHTML]="c.icon | icon"></i>
                <span>{{ i18n.pick(c, 'name') }}</span>
                <small>{{ countIn(c.id) }}</small>
              </a>
            }
          </nav>
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
          @if (countries().length) {
            <div class="pick" (keydown.escape)="countryOpen.set(false)">
              <button type="button" class="pick-btn" aria-haspopup="listbox" [attr.aria-expanded]="countryOpen()" [attr.aria-label]="i18n.t('origin')" (click)="toggleCountry($event)">
                @if (activeCountry() && flag(activeCountry()); as src) { <img class="flag" [src]="src" alt="" width="20" height="15"> }
                <span>{{ activeCountry() ? i18n.country(activeCountry()) : i18n.t('allCountries') }}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              @if (countryOpen()) {
                <ul class="pick-list" role="listbox" [attr.aria-label]="i18n.t('origin')">
                  <li role="option" [attr.aria-selected]="!activeCountry()"><button type="button" [class.on]="!activeCountry()" (click)="chooseCountry('')">{{ i18n.t('allCountries') }}</button></li>
                  @for (c of countries(); track c) {
                    <li role="option" [attr.aria-selected]="activeCountry() === c">
                      <button type="button" [class.on]="activeCountry() === c" (click)="chooseCountry(c)">
                        @if (flag(c); as src) { <img class="flag" [src]="src" alt="" width="20" height="15"> }
                        {{ i18n.country(c) }}
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
          }
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
  protected readonly country = signal('');
  /** Un pays absent du rayon affiché ne doit pas vider la liste */
  protected readonly activeCountry = computed(() => (this.countries().includes(this.country()) ? this.country() : ''));
  protected readonly countryOpen = signal(false);
  protected readonly flag = countryFlag;

  protected toggleCountry(e: Event) {
    e.stopPropagation();
    this.countryOpen.update(open => !open);
  }

  protected chooseCountry(country: string) {
    this.country.set(country);
    this.countryOpen.set(false);
  }

  /** Place du rayon choisi : la pastille y glisse, 0 pour Tout */
  protected readonly activeRayon = computed(() => this.shop.categories().findIndex(c => c.id === this.cat()) + 1);
  /** Pays en vente dans le rayon affiché */
  protected readonly countries = computed(() => {
    const cat = this.cat();
    return countriesIn(this.shop.products().filter(p => !cat || p.category === cat));
  });

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
    let found = this.shop.products().filter(p =>
      (!cat || p.category === cat) &&
      (!q || `${p.name_fr} ${p.name_ar} ${p.desc_fr} ${p.desc_ar}`.toLowerCase().includes(q)));
    const country = this.activeCountry();
    if (country) found = found.filter(p => availableOrigins(p).some(o => o.country === country));
    if (!sort) return found;
    return [...found].sort((a, b) => (sort === 'asc' ? lowestPrice(a) - lowestPrice(b) : lowestPrice(b) - lowestPrice(a)));
  });
}
