import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Cart, lineTotal } from '../core/cart';
import { DEFAULT_WEIGHTS, countryFlag, defaultOriginIndex, formatNumber, isLowStock, isOutOfStock, itemQty, noOriginLeft, originInSale, originsOf, roundStock } from '../core/data';
import { I18n } from '../core/i18n';
import { IconPipe } from '../core/icon';
import { Shop } from '../core/shop';
import { ProductCard } from './product-card';

const MIN_GRAMS = 100;

@Component({
  selector: 'app-product-page',
  imports: [RouterLink, IconPipe, ProductCard],
  template: `
    @if (product(); as p) {
      <section class="detail">
        <div class="wrap">
          <a class="back" routerLink="/boutique" [queryParams]="{ cat: p.category }">← {{ i18n.t('back') }}</a>
          <div class="detail-grid">
            <div class="detail-img" (mousemove)="zoomAt($event)">
              @if (p.image) {
                <img [src]="p.image" [alt]="i18n.pick(p, 'name')">
              } @else {
                <span class="card-icon big" [innerHTML]="icon() | icon"></span>
              }
            </div>
            <div class="detail-info">
              @if (i18n.fat(p); as fat) { <span class="fat-tag inline">{{ fat }}</span> }
              <h1>{{ i18n.pick(p, 'name') }}</h1>
              <div class="detail-price">
                {{ chosenOrigin() ? priceText(chosenOrigin()!.price) : i18n.price(p) }}
                @if (origins().length > 1 && chosenOrigin(); as o) {
                  <span class="price-country">
                    @if (flag(o.country); as src) { <img class="flag" [src]="src" alt="" width="20" height="15"> }{{ i18n.country(o.country) }}
                  </span>
                }
              </div>
              <p class="lead">{{ i18n.pick(p, 'desc') }}</p>
              @if (p.special) { <p class="special-note">{{ i18n.t('specialNote') }}</p> }

              @if (origins().length > 1) {
                <div class="pick-group">
                  <span class="pick-label">{{ i18n.t('origin') }}</span>
                  <div class="origin-cards">
                    @for (o of origins(); track o.country; let i = $index) {
                      <button class="origin-card" [class.on]="originIndex() === i" [disabled]="!inSale(o)" [attr.aria-pressed]="originIndex() === i" (click)="chooseOrigin(i)">
                        @if (flag(o.country); as src) { <img class="flag" [src]="src" alt="" width="24" height="18"> }
                        <b>{{ i18n.country(o.country) }}</b>
                        <small>{{ inSale(o) ? money(o.price) : i18n.t('unavailable') }}</small>
                      </button>
                    }
                  </div>
                </div>
              } @else if (i18n.countries(p).length) {
                <p class="origin-one">
                  @for (c of i18n.countries(p); track c.name) {
                    @if (c.flag) { <img class="flag" [src]="c.flag" alt="" width="20" height="15"> }{{ c.name }}
                  }
                </p>
              }

              @if (p.unit === 'kg') {
                <div class="pick-group">
                  <span class="pick-label">{{ i18n.t('weightShort') }}</span>
                  @if (mode() === 'weight') {
                    <div class="chips small">
                      @for (w of weights(); track w) {
                        <button class="chip" [class.on]="!customWeight() && grams() === w" (click)="customWeight.set(false); grams.set(w)">{{ i18n.weight(w) }}</button>
                      }
                      <button class="chip" [class.on]="customWeight()" (click)="customWeight.set(true)">{{ i18n.t('otherWeight') }}</button>
                    </div>
                    @if (customWeight()) {
                      <label class="inline-field slide-in"><input type="number" [min]="minGrams" step="50" [attr.aria-label]="i18n.t('customWeight')" [value]="grams()" (input)="setCustom($any($event.target).value)"><span>g</span></label>
                    }
                  } @else {
                    <label class="inline-field slide-in">
                      <input type="number" min="0" step="50" [placeholder]="i18n.t('amountHint')" [attr.aria-label]="i18n.t('amountLabel')" [value]="amount() || ''" (input)="setAmount($any($event.target).value)"><span>{{ i18n.t('currency') }}</span>
                    </label>
                    @if (amount()) { <small class="gives">{{ i18n.t('amountGives') }} {{ i18n.weight(grams()) }}</small> }
                  }
                  <button class="link-switch" (click)="setMode(mode() === 'weight' ? 'amount' : 'weight')">{{ i18n.t(mode() === 'weight' ? 'byAmount' : 'byWeight') }}</button>
                </div>
              }

              @if (options().length) {
                <div class="pick-group">
                  <span class="pick-label">{{ i18n.t('cutShort') }}</span>
                  <div class="chips small">
                    @for (o of options(); track o; let i = $index) {
                      <button class="chip" [class.on]="option() === i" (click)="option.set(i)">{{ o }}</button>
                    }
                  </div>
                </div>
              }

              @if (out()) {
                <div class="comeback" role="status">
                  <b>{{ i18n.t('soldOut') }} · {{ i18n.comeback(p) }}</b>
                  <a class="btn btn-wa-soft" target="_blank" [href]="notifyHref()">{{ i18n.t('notifyMe') }}</a>
                </div>
              }
              @if (stockNote(); as note) { <p class="stock-note">{{ note }}</p> }
              <div class="buy">
                <div class="qty">
                  <button (click)="qty.set(qty() - 1)" [disabled]="qty() <= 1" aria-label="-">−</button>
                  <span>{{ qty() }}</span>
                  <button (click)="qty.set(qty() + 1)" aria-label="+">+</button>
                </div>
                @for (t of [total()]; track t) {
                  <b class="buy-total pulse">{{ p.unit === 'order' ? i18n.t('toConfirm') : i18n.money(t) }}</b>
                }
                <button class="btn btn-red" [disabled]="out() || tooMuch() || (p.unit === 'kg' && grams() < minGrams)" (click)="add($event)">
                  {{ out() ? i18n.t('soldOut') : i18n.t('addCart') }}
                </button>
              </div>
              <p class="serve-line">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 7h12v10H2zM14 10h4l4 4v3h-8zM6.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg>
                {{ i18n.t(shop.pickupKey()) }}
              </p>
            </div>
          </div>
        </div>
      </section>

      @if (related().length) {
        <section class="products related">
          <div class="wrap">
            <div class="section-head"><h2>{{ i18n.t('sameCat') }}</h2></div>
            <div class="grid">
              @for (r of related(); track r.id) { <app-product-card [product]="r" /> }
            </div>
          </div>
        </section>
      }
    } @else {
      <section class="detail"><div class="wrap"><p class="empty">{{ i18n.t('noResult') }}</p>
        <a routerLink="/boutique" class="btn btn-red">{{ i18n.t('back') }}</a></div></section>
    }
  `,
})
export class ProductPage {
  protected readonly i18n = inject(I18n);
  protected readonly shop = inject(Shop);
  private readonly cart = inject(Cart);
  /** Paramètre de route :id */
  readonly id = input.required<string>();
  protected readonly minGrams = MIN_GRAMS;
  protected readonly flag = countryFlag;
  protected readonly inSale = originInSale;
  protected readonly grams = signal(0);
  protected readonly option = signal(0);
  protected readonly customWeight = signal(false);
  protected readonly originIndex = signal(0);
  protected readonly qty = signal(1);
  protected readonly mode = signal<'weight' | 'amount'>('weight');
  protected readonly amount = signal(0);

  protected readonly product = computed(() => this.shop.products().find(p => p.id === this.id()));
  protected readonly origins = computed(() => { const p = this.product(); return p ? originsOf(p) : []; });
  protected readonly chosenOrigin = computed(() => this.origins()[this.originIndex()]);
  private readonly unitPrice = computed(() => this.chosenOrigin()?.price ?? this.product()?.price ?? 0);
  protected readonly icon = computed(() => this.shop.category(this.product()?.category ?? '')?.icon);
  protected readonly weights = computed(() => {
    const w = this.product()?.weights;
    return w?.length ? w : DEFAULT_WEIGHTS;
  });
  protected readonly options = computed(() => {
    const p = this.product();
    if (!p) return [];
    const list = this.i18n.lang() === 'ar' ? p.options_ar : p.options_fr;
    return (list?.length ? list : p.options_fr) ?? [];
  });
  protected readonly related = computed(() => {
    const p = this.product();
    return this.shop.products().filter(x => x.category === p?.category && x.id !== p?.id).slice(0, 4);
  });

  private readonly line = computed(() => {
    const p = this.product()!;
    const i = this.option();
    return {
      productId: p.id, name_fr: p.name_fr, name_ar: p.name_ar, unit: p.unit, price: this.unitPrice(), qty: this.qty(),
      ...(p.special ? { special: true } : {}),
      ...(this.chosenOrigin() ? { origin: this.chosenOrigin()!.country } : {}),
      grams: p.unit === 'kg' ? this.grams() : undefined,
      option_fr: p.options_fr?.[i], option_ar: p.options_ar?.[i] ?? p.options_fr?.[i],
    };
  });

  protected readonly out = computed(() => !!this.product() && (isOutOfStock(this.product()!) || noOriginLeft(this.product()!)));
  private readonly stockLabel = computed(() => {
    const p = this.product()!;
    const left = roundStock(this.chosenOrigin()?.stock ?? p.stock ?? 0);
    return p.unit === 'kg' ? `${String(left).replace('.', ',')} ${this.i18n.t('kg')}` : String(left);
  });
  /** La quantité demandée dépasse le stock */
  protected readonly tooMuch = computed(() => {
    const p = this.product();
    return !!p?.trackStock && itemQty(this.line()) > (this.chosenOrigin()?.stock ?? p.stock ?? 0);
  });
  protected readonly stockNote = computed(() => {
    const p = this.product();
    if (!p || this.out()) return '';
    if (this.tooMuch()) return this.i18n.t('tooMuch').replace('{x}', this.stockLabel());
    return isLowStock(p) ? this.i18n.t('stockLeft').replace('{x}', this.stockLabel()) : '';
  });

  protected readonly total = computed(() => lineTotal({ ...this.line(), key: '' }));

  constructor() {
    // Nouveau produit : on repart du premier poids proposé
    effect(() => {
      this.id();
      this.grams.set(this.weights()[0]);
      this.option.set(0);
      this.customWeight.set(false);
      this.originIndex.set(defaultOriginIndex(this.origins()));
      this.qty.set(1);
      this.mode.set('weight');
      this.amount.set(0);
    });
  }

  protected money(price: number) {
    return this.i18n.money(price);
  }

  protected priceText(price: number) {
    const unit = this.product()?.unit === 'piece' ? this.i18n.t('perPiece') : this.i18n.t('perKg');
    return `${formatNumber(price)} ${unit}`;
  }

  /** Changer de pays change le prix : un achat « par montant » garde son montant. */
  protected chooseOrigin(i: number) {
    this.originIndex.set(i);
    if (this.mode() === 'amount') this.setAmount(String(this.amount()));
  }

  protected setMode(mode: 'weight' | 'amount') {
    this.mode.set(mode);
    if (mode === 'amount') this.setAmount(String(this.total()));
  }

  /** « 500 DA de kefta » : le poids se déduit du prix au kg */
  protected setAmount(value: string) {
    const amount = Math.max(0, Math.round(Number(value)) || 0);
    this.amount.set(amount);
    this.grams.set((amount * 1000) / this.unitPrice());
  }

  protected setCustom(value: string) {
    this.grams.set(Math.max(0, Math.round(Number(value)) || 0));
  }

  /** Le client demande sur WhatsApp à être prévenu du retour du produit */
  protected notifyHref() {
    const text = this.i18n.t('notifyMsg').replace('{p}', this.i18n.pick(this.product()!, 'name'));
    return `https://wa.me/${this.shop.settings().whatsapp}?text=${encodeURIComponent(text)}`;
  }

  /** Le zoom de la photo suit la souris */
  protected zoomAt(e: MouseEvent) {
    const box = e.currentTarget as HTMLElement;
    const r = box.getBoundingClientRect();
    box.style.setProperty('--ox', `${((e.clientX - r.left) / r.width) * 100}%`);
    box.style.setProperty('--oy', `${((e.clientY - r.top) / r.height) * 100}%`);
  }

  protected add(e: Event) {
    const page = (e.currentTarget as HTMLElement).closest('.detail');
    const pic = page?.querySelector<HTMLElement>('.detail-img img, .detail-img .card-icon') ?? undefined;
    this.cart.add(this.line(), this.i18n.pick(this.product()!, 'name'), pic);
  }
}
