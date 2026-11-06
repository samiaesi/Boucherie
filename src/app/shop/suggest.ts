import { Component, computed, inject } from '@angular/core';
import { quickLine, suggestProducts } from '../core/basket';
import { Cart, lineTotal } from '../core/cart';
import { Product } from '../core/data';
import { I18n } from '../core/i18n';
import { IconPipe } from '../core/icon';
import { Shop } from '../core/shop';

/** « Complétez votre panier » : un clic ajoute le produit proposé. */
@Component({
  selector: 'app-suggest',
  imports: [IconPipe],
  template: `
    @if (items().length) {
      <div class="suggest">
        <h4>{{ i18n.t('suggestTitle') }}</h4>
        @for (s of items(); track s.product.id) {
          <div class="suggest-item">
            @if (s.product.image) { <img [src]="s.product.image" alt="" loading="lazy"> }
            @else { <span class="suggest-icon" [innerHTML]="shop.category(s.product.category)?.icon | icon"></span> }
            <div>
              <b>{{ i18n.pick(s.product, 'name') }}</b>
              <small>{{ s.line.grams ? i18n.weight(s.line.grams) + ' · ' : '' }}{{ i18n.money(s.price) }}</small>
            </div>
            <button type="button" class="add" [attr.aria-label]="i18n.t('quickAdd')" (click)="add(s.product)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        }
      </div>
    }
  `,
})
export class Suggest {
  protected readonly i18n = inject(I18n);
  protected readonly shop = inject(Shop);
  private readonly cart = inject(Cart);
  protected readonly items = computed(() => suggestProducts(this.cart.lines(), this.shop.products()).map(product => {
    const line = quickLine(product);
    return { product, line, price: lineTotal({ ...line, key: '' }) };
  }));

  protected add(p: Product) {
    this.cart.add(quickLine(p), this.i18n.pick(p, 'name'));
  }
}
