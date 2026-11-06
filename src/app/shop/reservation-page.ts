import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { quickLine } from '../core/basket';
import { Campaign, campaignProducts, openCampaigns, validPickup } from '../core/campaigns';
import { lineTotal } from '../core/cart';
import { OrderItem, Product } from '../core/data';
import { I18n } from '../core/i18n';
import { normalizeTel, validTel } from '../core/loyalty';
import { algeriaClock } from '../core/ordering';
import { Shop } from '../core/shop';

const MAX_LABEL = 100;

@Component({
  selector: 'app-reservation-page',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="page-head"><div class="wrap"><h1>{{ campaign() ? i18n.pick(campaign()!, 'name') : i18n.t('resTitle') }}</h1>
      @if (campaign(); as c) { <p>{{ i18n.pick(c, 'text') }}</p> }</div></section>
    <section class="planner">
      <div class="wrap loyalty">
        @if (ref()) {
          <div class="loyalty-card">
            <small>{{ i18n.t('resDone') }}</small>
            <p>{{ i18n.t('resDoneText') }}</p>
            <a class="btn btn-white" [routerLink]="['/suivi', ref()]">{{ i18n.t('trackLink') }}</a>
          </div>
        } @else if (campaign(); as c) {
          @if (list().length > 1) {
            <div class="chips small res-tabs">
              @for (x of list(); track x.id) { <button class="chip" [class.on]="x.id === c.id" (click)="pick(x)">{{ i18n.pick(x, 'name') }}</button> }
            </div>
          }
          <div class="res-products">
            @for (p of items(); track p.id) {
              <button type="button" class="res-item" [class.on]="product()?.id === p.id" [attr.aria-pressed]="product()?.id === p.id" (click)="choose(p)">
                @if (p.image) { <img [src]="p.image" alt="" loading="lazy"> }
                <span><b>{{ i18n.pick(p, 'name') }}</b><small>{{ i18n.price(p) }}</small></span>
              </button>
            }
          </div>
          @if (product(); as p) {
            <form class="co-form res-form" (ngSubmit)="send(c, p)">
              @if (p.unit === 'kg' && p.weights?.length) {
                <div class="pick-group">
                  <span class="pick-label">{{ i18n.t('weightShort') }}</span>
                  <div class="chips small">
                    @for (w of p.weights; track w) { <button type="button" class="chip" [class.on]="grams() === w" (click)="grams.set(w)">{{ i18n.weight(w) }}</button> }
                  </div>
                </div>
              }
              <div class="pick-group">
                <span class="pick-label">{{ i18n.t('resQty') }}</span>
                <div class="qty">
                  <button type="button" (click)="qty.set(qty() - 1)" [disabled]="qty() <= 1" aria-label="-">−</button>
                  <span>{{ qty() }}</span>
                  <button type="button" (click)="qty.set(qty() + 1)" aria-label="+">+</button>
                </div>
              </div>
              <label>{{ i18n.t('fName') }}<input required name="name" maxlength="100" [(ngModel)]="form.name"></label>
              <label>{{ i18n.t('fTel') }}<input required name="tel" type="tel" inputmode="tel" dir="ltr" placeholder="05 55 12 34 56" [(ngModel)]="form.tel"></label>
              <label>{{ i18n.t('pickupDate') }}<input required name="date" type="date" [min]="c.pickupFrom" [max]="c.pickupTo" [(ngModel)]="form.date"></label>
              <div class="sum"><span>{{ i18n.t('total') }}</span><b>{{ i18n.total(total(), line()?.unit === 'order') }}</b></div>
              @if (c.deposit > 0) { <p class="special-note">{{ i18n.t('resDeposit').replace('{x}', i18n.money(c.deposit * qty())) }}</p> }
              <p class="note">{{ i18n.t('resUntil').replace('{d}', c.closes) }}</p>
              @if (error()) { <div class="form-error" role="alert">{{ i18n.t(error()!) }}</div> }
              <button class="btn btn-red block" type="submit" [disabled]="sending()">{{ i18n.t(sending() ? 'sending' : 'resSend') }}</button>
            </form>
          }
        } @else {
          <p class="empty">{{ i18n.t('resNone') }}</p>
          <div class="plan-more"><a routerLink="/boutique" class="btn btn-red">{{ i18n.t('seeAll') }}</a></div>
        }
      </div>
    </section>
  `,
})
export class ReservationPage {
  protected readonly i18n = inject(I18n);
  private readonly shop = inject(Shop);
  protected readonly list = computed(() => openCampaigns(this.shop.campaigns(), algeriaClock(this.shop.clock()).date));
  private readonly chosen = signal('');
  protected readonly campaign = computed(() => this.list().find(c => c.id === this.chosen()) ?? this.list()[0]);
  protected readonly items = computed(() => { const c = this.campaign(); return c ? campaignProducts(c, this.shop.products()) : []; });
  protected readonly product = signal<Product | null>(null);
  protected readonly grams = signal(0);
  protected readonly qty = signal(1);
  protected readonly sending = signal(false);
  protected readonly error = signal<'resBadTel' | 'resBadDate' | 'orderFail' | null>(null);
  protected readonly ref = signal('');
  protected form = { name: this.shop.customer.name, tel: this.shop.customer.tel, date: '' };

  protected readonly line = computed(() => {
    const p = this.product();
    if (!p) return null;
    const base = quickLine(p);
    return { ...base, qty: this.qty(), grams: p.unit === 'kg' ? this.grams() || base.grams : undefined };
  });
  protected readonly total = computed(() => { const l = this.line(); return l ? lineTotal({ ...l, key: '' }) : 0; });

  constructor() {
    // Une seule offre : elle est déjà choisie
    effect(() => {
      const items = this.items();
      if (items.length === 1 && !this.product()) this.choose(items[0]);
    });
  }

  protected pick(c: Campaign) {
    this.chosen.set(c.id);
    this.product.set(null);
  }

  protected choose(p: Product) {
    this.product.set(p);
    this.grams.set(p.weights?.[0] ?? 0);
    this.qty.set(1);
  }

  protected async send(c: Campaign, p: Product) {
    const f = this.form, line = this.line();
    if (!line) return;
    if (!validTel(f.tel)) { this.error.set('resBadTel'); return; }
    if (!validPickup(c, f.date)) { this.error.set('resBadDate'); return; }
    this.error.set(null);
    this.sending.set(true);
    const name = this.i18n.pick(c, 'name'), total = this.total();
    const item: OrderItem = {
      productId: p.id, unit: line.unit, qty: line.qty, name_fr: p.name_fr, name_ar: p.name_ar, price: line.price, total,
      ...(line.grams ? { grams: line.grams } : {}),
      ...(line.origin ? { origin: line.origin } : {}),
    };
    const amount = this.i18n.total(total, line.unit === 'order');
    const details = [
      `${name} · ${line.qty} × ${this.i18n.pick(p, 'name')}${line.grams ? ` · ${this.i18n.weight(line.grams)}` : ''}`,
      `${this.i18n.t('total')} : ${amount}`,
      c.deposit > 0 ? this.i18n.t('resDeposit').replace('{x}', this.i18n.money(c.deposit * line.qty)) : '',
    ].filter(Boolean).join('\n');
    try {
      const ref = await this.shop.createOrder({
        name: f.name.trim(), tel: normalizeTel(f.tel), type: 'retrait', date: f.date, details, lang: this.i18n.lang(),
        items: [item], delivery: 0, total, typeLabel: `${name} · ${amount}`.slice(0, MAX_LABEL),
      });
      this.shop.rememberCustomer({ name: f.name, tel: f.tel });
      this.ref.set(ref);
    } catch (e) {
      console.error('Réservation non enregistrée', e);
      this.error.set('orderFail');
    } finally {
      this.sending.set(false);
    }
  }
}
