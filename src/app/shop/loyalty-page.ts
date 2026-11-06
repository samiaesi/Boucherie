import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../core/firebase';
import { I18n } from '../core/i18n';
import { loyaltyProgress, normalizeTel, validTel } from '../core/loyalty';
import { Shop } from '../core/shop';

@Component({
  selector: 'app-loyalty-page',
  imports: [FormsModule],
  template: `
    <section class="page-head"><div class="wrap"><h1>{{ i18n.t('loyaltyTitle') }}</h1><p>{{ rule() }}</p></div></section>
    <section class="planner">
      <div class="wrap loyalty">
        @if (!settings().loyaltyEnabled) {
          <p class="empty">{{ i18n.t('loyaltySoon') }}</p>
        } @else {
          <form class="plan-form loyalty-form" (ngSubmit)="check()">
            <label>{{ i18n.t('fTel') }}<input name="tel" type="tel" inputmode="tel" dir="ltr" placeholder="05 55 12 34 56" [(ngModel)]="tel"></label>
            <button class="btn btn-red" type="submit" [disabled]="busy()">{{ i18n.t('loyaltyCheck') }}</button>
          </form>
          @if (error()) { <div class="form-error" role="alert">{{ i18n.t(error()!) }}</div> }
          @if (points() !== null) {
            <div class="loyalty-card">
              <small>{{ i18n.t('loyaltyYours') }}</small>
              <b>{{ points() }}</b>
              @if (settings().loyaltyGoal > 0) {
                <div class="loyalty-bar" role="progressbar" [attr.aria-valuenow]="progress()" aria-valuemin="0" aria-valuemax="100"><i [style.width.%]="progress()"></i></div>
                <p>{{ goalText() }}</p>
              }
            </div>
          }
        }
      </div>
    </section>
  `,
})
export class LoyaltyPage implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly shop = inject(Shop);
  protected readonly settings = this.shop.settings;
  protected tel = '';
  protected readonly points = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<'loyaltyBadTel' | 'orderFail' | null>(null);
  protected readonly progress = computed(() => loyaltyProgress(this.points() ?? 0, this.settings().loyaltyGoal));

  protected readonly rule = computed(() => this.i18n.t('loyaltyRule').replace('{x}', this.i18n.money(this.settings().loyaltyEvery)));
  protected readonly goalText = computed(() => {
    const s = this.settings(), left = s.loyaltyGoal - (this.points() ?? 0);
    const reward = this.i18n.pick(s, 'loyaltyReward') || this.i18n.t('loyaltyGift');
    return left > 0
      ? this.i18n.t('loyaltyLeft').replace('{n}', String(left)).replace('{r}', reward)
      : this.i18n.t('loyaltyReady').replace('{r}', reward);
  });

  /** Un client déjà reconnu voit ses points tout de suite. */
  ngOnInit() {
    this.tel = this.shop.myTel();
    if (this.tel) this.check();
  }

  protected async check() {
    this.points.set(null);
    if (!validTel(this.tel)) {
      this.error.set('loyaltyBadTel');
      return;
    }
    this.error.set(null);
    this.busy.set(true);
    try {
      const snap = await getDoc(doc(db, 'loyalty', normalizeTel(this.tel)));
      this.points.set(snap.exists() ? (snap.data()['points'] as number) : 0);
      this.shop.rememberTel(this.tel);
    } catch (e) {
      console.warn('Carte de fidélité indisponible', e);
      this.error.set('orderFail');
    } finally {
      this.busy.set(false);
    }
  }
}
