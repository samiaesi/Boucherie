import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Timestamp, doc, onSnapshot } from 'firebase/firestore';
import { OrderStatus } from '../core/data';
import { db } from '../core/firebase';
import { I18n, TKey } from '../core/i18n';
import { MyPoints } from './my-points';

interface Tracking {
  status: OrderStatus;
  delivery: boolean;
  date: string;
  ref: string;
  steps: Partial<Record<OrderStatus, Timestamp>>;
}

const PICKUP_STEPS: OrderStatus[] = ['nouveau', 'confirmé', 'prêt', 'récupéré'];
const DELIVERY_STEPS: OrderStatus[] = ['nouveau', 'confirmé', 'prêt', 'en livraison', 'livré'];

const STEP_LABELS: Record<OrderStatus, TKey> = {
  nouveau: 'trackNew', confirmé: 'trackConfirmed', prêt: 'trackReady', 'en livraison': 'trackOnWay',
  livré: 'trackDelivered', récupéré: 'trackPicked', annulé: 'trackCancelled',
};

/** Suivi public : l'identifiant du lien, impossible à deviner, donne accès à l'état de la commande seul. */
@Component({
  selector: 'app-track-page',
  imports: [MyPoints, RouterLink],
  template: `
    <section class="page-head"><div class="wrap"><h1>{{ i18n.t('trackTitle') }}</h1></div></section>
    <section class="shop">
      <div class="wrap track">
        @if (track(); as t) {
          <div class="track-head">
            <span>{{ i18n.t('orderRef') }} : <b>{{ t.ref }}</b></span>
            <span>{{ i18n.t(t.delivery ? 'deliveryDate' : 'pickupDate') }} : <b>{{ t.date }}</b></span>
          </div>
          @if (t.status === 'annulé') {
            <div class="form-error" role="status">{{ i18n.t('trackCancelled') }}</div>
          } @else {
            <ol class="steps-line">
              @for (s of steps(); track s; let i = $index) {
                <li [class.done]="i <= current()" [class.now]="i === current()">
                  <span class="dot">{{ i < current() ? '✓' : i + 1 }}</span>
                  <div><b>{{ i18n.t(label(s)) }}</b>
                    @if (when(s); as w) { <small dir="ltr">{{ w }}</small> }</div>
                </li>
              }
            </ol>
          }
        } @else if (missing()) {
          <p class="empty">{{ i18n.t('trackMissing') }}</p>
        }
        <app-my-points />
        <div class="center"><a routerLink="/boutique" class="btn btn-red">{{ i18n.t('keepShopping') }}</a></div>
      </div>
    </section>
  `,
})
export class TrackPage implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  /** Paramètre de route :id */
  readonly id = input.required<string>();
  protected readonly track = signal<Tracking | null>(null);
  protected readonly missing = signal(false);
  protected readonly label = (s: OrderStatus) => STEP_LABELS[s];
  private stop?: () => void;

  protected readonly steps = computed(() => (this.track()?.delivery ? DELIVERY_STEPS : PICKUP_STEPS));
  protected readonly current = computed(() => this.steps().indexOf(this.track()?.status ?? 'nouveau'));

  ngOnInit() {
    // En direct : la page avance toute seule quand le boucher change le statut
    this.stop = onSnapshot(doc(db, 'tracking', this.id()), snap => {
      this.track.set(snap.exists() ? (snap.data() as Tracking) : null);
      this.missing.set(!snap.exists());
    }, () => this.missing.set(true));
  }

  ngOnDestroy() {
    this.stop?.();
  }

  protected when(s: OrderStatus) {
    const at = this.track()?.steps?.[s];
    if (!at) return '';
    return at.toDate().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }
}
