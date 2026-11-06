import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../core/firebase';
import { I18n } from '../core/i18n';
import { Shop } from '../core/shop';

/** Solde du client reconnu sur cet appareil, mis à jour en direct quand ses points arrivent. */
@Component({
  selector: 'app-my-points',
  imports: [RouterLink],
  template: `
    @if (shown()) {
      <a class="my-points" routerLink="/fidelite">
        <span>{{ i18n.t('loyaltyYours') }}</span><b>{{ points() }}</b>
      </a>
    }
  `,
})
export class MyPoints implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly shop = inject(Shop);
  protected readonly points = signal<number | null>(null);
  protected readonly shown = computed(() => this.shop.settings().loyaltyEnabled && this.points() !== null);
  private stop?: () => void;

  ngOnInit() {
    const tel = this.shop.myTel();
    if (!tel) return;
    this.stop = onSnapshot(doc(db, 'loyalty', tel),
      snap => this.points.set(snap.exists() ? (snap.data()['points'] as number) : 0),
      e => console.warn('Points indisponibles', e));
  }

  ngOnDestroy() {
    this.stop?.();
  }
}
