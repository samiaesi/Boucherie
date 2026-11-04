import { Component, inject } from '@angular/core';
import { I18n } from '../core/i18n';
import { Shop } from '../core/shop';

/** Message affiché quand le site ne prend pas de commandes. */
@Component({
  selector: 'app-closed-notice',
  template: `
    @if (!shop.ordering().open) {
      <div class="closed-bar" role="status">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" />
        </svg>
        <div><b>{{ i18n.t('closedTitle') }}</b><p>{{ i18n.closedMessage(shop.ordering()) }}</p></div>
      </div>
    }
  `,
})
export class ClosedNotice {
  protected readonly i18n = inject(I18n);
  protected readonly shop = inject(Shop);
}
