import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { doc, getDoc } from 'firebase/firestore';
import { Cart } from '../core/cart';
import { db } from '../core/firebase';
import { I18n } from '../core/i18n';
import { MENU_RECIPES, MenuProposal, MenuRecipe, MenuStyle, planMenus } from '../core/menu-planner';
import { Shop } from '../core/shop';

const MIN_GUESTS = 2;
const MAX_GUESTS = 50;
const NO_LIMIT = 60000;
const PAGE_SIZE = 6;

@Component({
  selector: 'app-menu-page',
  imports: [RouterLink],
  template: `
    <section class="page-head"><div class="wrap"><h1>{{ i18n.t('menuTitle') }}</h1><p>{{ i18n.t('menuLead') }}</p></div></section>
    <section class="planner">
      <div class="wrap">
        <div class="plan-form">
          <div class="plan-field">
            <span class="pick-label">{{ i18n.t('menuGuests') }}</span>
            <div class="qty">
              <button (click)="setGuests(guests() - 1)" [disabled]="guests() <= minGuests" aria-label="-">−</button>
              <span>{{ guests() }}</span>
              <button (click)="setGuests(guests() + 1)" [disabled]="guests() >= maxGuests" aria-label="+">+</button>
            </div>
          </div>
          <label class="plan-field">
            <span class="pick-label">{{ i18n.t('menuBudget') }} : <b>{{ budgetText() }}</b></span>
            <input type="range" min="2000" [max]="noLimit" step="1000" [attr.aria-label]="i18n.t('menuBudget')" [value]="budget()" (input)="budget.set(+$any($event.target).value)">
          </label>
          <div class="plan-field">
            <span class="pick-label">{{ i18n.t('menuStyle') }}</span>
            <div class="chips small">
              @for (s of styles; track s.id) {
                <button class="chip" [class.on]="style() === s.id" [attr.aria-pressed]="style() === s.id" (click)="style.set(s.id)">{{ i18n.t(s.key) }}</button>
              }
            </div>
          </div>
        </div>

        <div class="plan-results">
          @for (m of menus().slice(0, shown()); track m.id; let i = $index) {
            <article class="plan-card" [style.--d]="i">
              <div class="plan-photos">
                @for (src of m.images.slice(0, 2); track src) { <img [src]="src" alt="" loading="lazy"> }
              </div>
              <div class="plan-body">
                <h2>{{ i18n.pick(m, 'name') }}</h2>
                <ul>
                  @for (l of m.lines; track l.productId) {
                    <li><b>{{ l.grams ? i18n.weight(l.grams) : l.qty + ' ×' }}</b> {{ i18n.pick(l, 'name') }}@if (l.option_fr) { <small>{{ i18n.pick(l, 'option') }}</small> }</li>
                  }
                </ul>
                <div class="plan-price">
                  <b>{{ i18n.total(m.total, m.pending) }}</b>
                  @if (!m.pending) { <small>≈ {{ i18n.money(perGuest(m)) }} {{ i18n.t('menuEach') }}</small> }
                </div>
                @if (m.over) { <p class="note">{{ i18n.t('menuOver') }}</p> }
                <button class="btn btn-red block" (click)="addAll(m)">{{ i18n.t(added() === m.id ? 'menuAdded' : 'menuAdd') }}</button>
              </div>
            </article>
          } @empty {
            <p class="empty">{{ i18n.t('menuNone') }} <a routerLink="/boutique">{{ i18n.t('seeAll') }}</a></p>
          }
        </div>
        @if (menus().length > shown()) {
          <div class="plan-more"><button class="btn btn-outline" (click)="shown.set(shown() + step)">{{ i18n.t('menuMore') }} ({{ menus().length - shown() }})</button></div>
        }
        <p class="note plan-note">{{ i18n.t('menuNote') }}</p>
      </div>
    </section>
  `,
})
export class MenuPage implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly shop = inject(Shop);
  private readonly cart = inject(Cart);
  protected readonly minGuests = MIN_GUESTS;
  protected readonly maxGuests = MAX_GUESTS;
  protected readonly noLimit = NO_LIMIT;
  protected readonly styles = [
    { id: 'all', key: 'menuAll' }, { id: 'fete', key: 'menuFeast' }, { id: 'simple', key: 'menuSimple' },
    { id: 'grill', key: 'menuGrill' }, { id: 'mer', key: 'menuFish' },
  ] as const;
  protected readonly guests = signal(6);
  protected readonly budget = signal(NO_LIMIT);
  protected readonly style = signal<MenuStyle | 'all'>('all');
  protected readonly added = signal('');
  protected readonly step = PAGE_SIZE;
  protected readonly shown = signal(PAGE_SIZE);

  /** Menus créés dans l'admin, sinon ceux par défaut */
  private readonly recipes = signal<MenuRecipe[]>(MENU_RECIPES);

  protected readonly menus = computed(() => planMenus(this.shop.products(), {
    guests: this.guests(), style: this.style(), budget: this.budget() >= NO_LIMIT ? 0 : this.budget(),
  }, this.recipes()));
  protected readonly budgetText = computed(() => (this.budget() >= NO_LIMIT ? this.i18n.t('menuNoLimit') : this.i18n.money(this.budget())));

  async ngOnInit() {
    try {
      const snap = await getDoc(doc(db, 'settings', 'menus'));
      if (snap.exists()) this.recipes.set(snap.data()['list'] as MenuRecipe[]);
    } catch (e) {
      console.warn('Menus indisponibles, affichage des menus par défaut', e);
    }
  }

  protected setGuests(n: number) {
    this.guests.set(Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, n)));
  }

  protected perGuest(m: MenuProposal) {
    return Math.round(m.total / this.guests());
  }

  protected addAll(m: MenuProposal) {
    m.lines.forEach(l => this.cart.add(l, this.i18n.pick(m, 'name')));
    this.added.set(m.id);
    setTimeout(() => this.added.set(''), 1800);
  }
}
