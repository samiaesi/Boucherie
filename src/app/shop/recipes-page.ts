import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Cart } from '../core/cart';
import { I18n } from '../core/i18n';
import { Recipe, recipeLines } from '../core/recipes';
import { Shop } from '../core/shop';

@Component({
  selector: 'app-recipes-page',
  imports: [RouterLink],
  template: `
    <section class="page-head"><div class="wrap"><h1>{{ i18n.t('recipesTitle') }}</h1><p>{{ i18n.t('recipesLead') }}</p></div></section>
    <section class="recipes">
      <div class="wrap recipe-grid">
        @for (r of shop.recipes(); track r.id) {
          @if (!r.hidden) {
            <article class="recipe" [id]="r.id">
              <div class="recipe-photo">
                @if (photo(r); as src) { <img [src]="src" alt="" loading="lazy"> }
                <div class="recipe-chips">
                  <span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M10 2h4" /></svg>{{ i18n.t('recipeMinutes').replace('{n}', '' + r.minutes) }}</span>
                  <span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.4c2.1.8 3.5 2.8 3.5 5.6" /></svg>{{ i18n.t('recipeServes').replace('{n}', '' + r.serves) }}</span>
                </div>
              </div>
              <div class="recipe-body">
                <h2>{{ i18n.pick(r, 'name') }}</h2>
                <h3>{{ i18n.t('recipeBuy') }}</h3>
                <ul class="recipe-buy">
                  @for (it of r.items; track it.product) {
                    @if (product(it.product); as p) {
                      <li>
                        <a [routerLink]="['/produit', p.id]">
                          <span class="thumb">@if (p.image) { <img [src]="p.image" alt="" loading="lazy"> }</span>
                          <span class="pname">{{ i18n.pick(p, 'name') }}</span>
                        </a>
                        <b>{{ p.unit === 'kg' ? i18n.weight(it.grams ?? 1000) : (it.qty ?? 1) + ' ×' }}</b>
                      </li>
                    }
                  }
                </ul>
                <h3>{{ i18n.t('recipeSteps') }}</h3>
                <ol class="recipe-steps">
                  @for (s of steps(r); track $index; let i = $index) { <li><i>{{ i + 1 }}</i><span>{{ s }}</span></li> }
                </ol>
                <button class="btn btn-red block" [disabled]="!lines(r).length" (click)="addAll(r)">
                  {{ added() === r.id ? i18n.t('recipeAdded') : i18n.t('recipeAdd') }}
                </button>
                @if (lines(r).length < r.items.length) { <p class="note">{{ i18n.t('recipeMissing') }}</p> }
              </div>
            </article>
          }
        }
      </div>
    </section>
  `,
})
export class RecipesPage implements OnInit {
  protected readonly i18n = inject(I18n);
  protected readonly shop = inject(Shop);
  private readonly cart = inject(Cart);
  protected readonly added = signal('');

  ngOnInit() {
    this.shop.loadRecipes();
    document.title = `${this.i18n.t('recipesTitle')} — ${this.i18n.pick(this.shop.settings(), 'name')}`;
  }

  protected product(id: string) {
    return this.shop.products().find(p => p.id === id && p.available);
  }

  /** Photo de la recette : celle du premier produit qui en a une */
  protected photo(r: Recipe) {
    for (const it of r.items) {
      const img = this.shop.products().find(p => p.id === it.product)?.image;
      if (img) return img.includes('images.unsplash.com') ? img.replace(/w=\d+/, 'w=900') : img;
    }
    return '';
  }

  protected steps(r: Recipe) {
    return this.i18n.pick(r, 'steps').split('\n').map(s => s.trim()).filter(Boolean);
  }

  protected lines(r: Recipe) {
    return recipeLines(r, this.shop.products());
  }

  protected addAll(r: Recipe) {
    this.lines(r).forEach(l => this.cart.add(l, this.i18n.pick(r, 'name')));
    this.added.set(r.id);
    setTimeout(() => this.added.set(''), 1800);
  }
}
