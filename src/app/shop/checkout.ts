import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Cart, CartLine, lineTotal } from '../core/cart';
import { OrderItem, deliveryCost, orderRef } from '../core/data';
import { I18n, TKey } from '../core/i18n';
import { Shop } from '../core/shop';

/** Longueur maximale du champ details acceptée par firestore.rules */
const MAX_DETAILS = 2000;
/** Mobile algérien : 05, 06 ou 07 suivi de 8 chiffres, requis pour la confirmation WhatsApp */
const PHONE = /^0[567]\d{8}$/;

@Component({
  selector: 'app-checkout',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="page-head"><div class="wrap"><h1>{{ i18n.t('checkoutTitle') }}</h1></div></section>
    <section class="shop">
      <div class="wrap">
        @if (ref()) {
          <div class="done">
            <span>✓</span>
            <h2>{{ i18n.t('doneTitle') }}</h2>
            <div class="ref">{{ i18n.t('orderRef') }} : <b>{{ reference() }}</b></div>
            <p>{{ i18n.t('doneText') }}</p>
            <a [routerLink]="['/suivi', ref()]" class="btn btn-red block">{{ i18n.t('trackLink') }}</a>
            <a routerLink="/" class="btn-text">{{ i18n.t('backHome') }}</a>
          </div>
        } @else if (!cart.lines().length) {
          <p class="empty">{{ i18n.t('cartEmpty') }}</p>
          <div class="center"><a routerLink="/boutique" class="btn btn-red">{{ i18n.t('seeAll') }}</a></div>
        } @else {
          <div class="checkout-grid">
            <form class="co-form" #f="ngForm" (ngSubmit)="submit(f)">
              @if (shop.settings().deliveryEnabled) {
                <h3>{{ i18n.t('modeTitle') }}</h3>
                <div class="modes">
                  <button type="button" class="mode-card" [class.on]="mode() === 'retrait'" (click)="mode.set('retrait')">
                    <span>🏪</span><b>{{ i18n.t('modePickup') }}</b><small>{{ i18n.t('modePickupHint') }}</small>
                  </button>
                  <button type="button" class="mode-card" [class.on]="mode() === 'livraison'" (click)="mode.set('livraison')">
                    <span>🚚</span><b>{{ i18n.t('modeDelivery') }}</b><small>{{ feeLabel(cost()) }}</small>
                  </button>
                </div>
              } @else {
                <p class="pickup">🏪 {{ i18n.t(shop.pickupKey()) }}</p>
              }
              <label>{{ i18n.t('fName') }}<input required name="name" [(ngModel)]="form.name"></label>
              <label>{{ i18n.t('fTel') }}<input required name="tel" type="tel" inputmode="tel" placeholder="05 55 12 34 56" dir="ltr" [(ngModel)]="form.tel"></label>
              @if (mode() === 'livraison') {
                <label class="slide-in">{{ i18n.t('zone') }}
                  <select required name="zone" [(ngModel)]="form.zone">
                    <option value="">{{ i18n.t('zoneChoose') }}</option>
                    @for (z of shop.settings().deliveryZones; track z) { <option [value]="z">{{ z }}</option> }
                  </select>
                </label>
                <label class="slide-in">{{ i18n.t('address') }}<textarea required name="address" rows="2" [(ngModel)]="form.address"></textarea></label>
              }
              <label>{{ i18n.t(mode() === 'livraison' ? 'deliveryDate' : 'pickupDate') }}<input required name="date" type="date" [min]="today" [(ngModel)]="form.date"></label>
              <label>{{ i18n.t('notes') }}<textarea name="notes" [(ngModel)]="form.notes"></textarea></label>
              @if (error()) { <div class="form-error" role="alert">{{ error() }}</div> }
              <button class="btn btn-red block" type="submit" [disabled]="f.invalid || sending()">
                {{ sending() ? i18n.t('sending') : i18n.t('sendOrder') }}
              </button>
              <p class="note">{{ i18n.t(mode() === 'livraison' ? 'payDelivery' : 'fNote') }}</p>
            </form>
            <aside class="summary">
              <h3>{{ i18n.t('summary') }}</h3>
              @for (l of cart.lines(); track l.key) {
                <div class="sum-line">
                  <span>{{ l.qty }} × {{ describe(l) }}</span>
                  <b>{{ l.unit === 'order' ? i18n.t('toConfirm') : i18n.money(total(l)) }}</b>
                </div>
              }
              @if (mode() === 'livraison') {
                <div class="sum-line"><span>{{ i18n.t('subtotal') }}</span><b>{{ i18n.money(cart.total()) }}</b></div>
                <div class="sum-line"><span>{{ i18n.t('delivery') }}</span><b>{{ feeLabel(fee()) }}</b></div>
                @if (freeLeft() > 0) { <p class="pickup">🎁 {{ freeLeftText() }}</p> }
              }
              <div class="sum"><span>{{ i18n.t('total') }}</span><b>{{ i18n.money(grandTotal()) }}</b></div>
              <p class="note">{{ i18n.t('estimate') }}</p>
            </aside>
          </div>
        }
      </div>
    </section>
  `,
})
export class Checkout {
  protected readonly i18n = inject(I18n);
  protected readonly cart = inject(Cart);
  protected readonly shop = inject(Shop);
  /** Référence de la commande envoyée */
  protected readonly ref = signal('');
  protected readonly reference = computed(() => orderRef(this.ref()));
  protected readonly error = signal('');
  protected readonly sending = signal(false);
  protected readonly total = lineTotal;
  protected readonly today = this.localDate();
  protected form = { name: '', tel: '', zone: '', address: '', date: this.today, notes: '' };
  protected readonly mode = signal<'retrait' | 'livraison'>('retrait');

  /** Frais si le client choisit la livraison */
  protected readonly cost = computed(() => deliveryCost(this.shop.settings(), this.cart.total()));
  protected readonly fee = computed(() => (this.mode() === 'livraison' ? this.cost() : 0));
  protected readonly grandTotal = computed(() => this.cart.total() + this.fee());
  /** Ce qu'il manque au panier pour une livraison offerte */
  protected readonly freeLeft = computed(() => {
    const s = this.shop.settings();
    return s.deliveryFreeFrom > 0 && s.deliveryFee > 0 ? s.deliveryFreeFrom - this.cart.total() : 0;
  });

  protected feeLabel(fee: number) {
    return fee ? this.i18n.money(fee) : this.i18n.t('free');
  }

  protected freeLeftText() {
    return this.i18n.t('freeLeft').replace('{x}', this.i18n.money(this.freeLeft()));
  }

  private localDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  protected describe(l: CartLine) {
    return [
      this.i18n.pick(l, 'name'),
      l.grams ? this.i18n.weight(l.grams) : '',
      l.option_fr ? this.i18n.pick(l, 'option') : '',
    ].filter(Boolean).join(' · ');
  }

  /** Articles de la commande, pour le stock et la facture */
  private items(): OrderItem[] {
    return this.cart.lines().map(l => ({
      productId: l.productId, unit: l.unit, qty: l.qty, name_fr: l.name_fr, name_ar: l.name_ar, price: l.price, total: lineTotal(l),
      ...(l.grams ? { grams: l.grams } : {}),
      ...(l.option_fr ? { option_fr: l.option_fr, option_ar: l.option_ar ?? l.option_fr } : {}),
    }));
  }

  protected async submit(ngForm: NgForm) {
    if (ngForm.invalid || this.sending()) return;
    const f = this.form, t = (k: TKey) => this.i18n.t(k);
    const tel = f.tel.replace(/[\s.-]/g, '');
    if (!PHONE.test(tel)) {
      this.error.set(t('telInvalid'));
      return;
    }
    const lines = this.cart.lines().map(l =>
      `- ${l.qty} × ${this.describe(l)} : ${l.unit === 'order' ? t('toConfirm') : this.i18n.money(lineTotal(l))}`);
    const delivery = this.mode() === 'livraison';
    const total = this.i18n.money(this.grandTotal());
    const details = [
      ...lines,
      delivery && `${t('delivery')} : ${this.feeLabel(this.fee())}`,
      `${t('total')} : ${total}`,
      delivery && `${t('address')} : ${f.zone} — ${f.address.trim()}`,
      f.notes.trim() && `${t('notes')} : ${f.notes.trim()}`,
    ].filter(Boolean).join('\n').slice(0, MAX_DETAILS);

    this.sending.set(true);
    this.error.set('');
    try {
      this.ref.set(await this.shop.createOrder({
        name: f.name.trim(), tel, type: this.mode(), date: f.date, details, lang: this.i18n.lang(), items: this.items(),
        delivery: this.fee(), total: this.grandTotal(), ...(delivery ? { address: `${f.zone} — ${f.address.trim()}`, zone: f.zone } : {}),
        typeLabel: `${t('basket')} · ${this.cart.count()} ${t('articles')} · ${total}`,
      }));
      this.cart.clear();
    } catch (err) {
      console.error('Commande non enregistrée', err);
      this.error.set(t('orderFail'));
    } finally {
      this.sending.set(false);
    }
  }
}
