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
              <header>
                <h2>{{ i18n.pick(r, 'name') }}</h2>
                <div class="meta">
                  <span>⏱ {{ i18n.t('recipeMinutes').replace('{n}', '' + r.minutes) }}</span>
                  <span>👥 {{ i18n.t('recipeServes').replace('{n}', '' + r.serves) }}</span>
                </div>
              </header>
              <h3>{{ i18n.t('recipeBuy') }}</h3>
              <ul class="buy">
                @for (it of r.items; track it.product) {
                  @if (product(it.product); as p) {
                    <li><a [routerLink]="['/produit', p.id]">{{ i18n.pick(p, 'name') }}</a>
                      <b>{{ p.unit === 'kg' ? i18n.weight(it.grams ?? 1000) : (it.qty ?? 1) + ' ×' }}</b></li>
                  }
                }
              </ul>
              <h3>{{ i18n.t('recipeSteps') }}</h3>
              <ol class="recipe-steps">
                @for (s of steps(r); track $index) { <li>{{ s }}</li> }
              </ol>
              <button class="btn btn-red block" [disabled]="!lines(r).length" (click)="addAll(r)">
                {{ added() === r.id ? i18n.t('recipeAdded') : i18n.t('recipeAdd') }}
              </button>
              @if (lines(r).length < r.items.length) { <p class="note">{{ i18n.t('recipeMissing') }}</p> }
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
