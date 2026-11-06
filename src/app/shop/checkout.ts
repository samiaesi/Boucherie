import { Suggest } from './suggest';
import { pointsFor } from '../core/loyalty';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Cart, CartLine, lineTotal } from '../core/cart';
import { OrderItem, deliveryCost, orderRef } from '../core/data';
import { I18n, TKey } from '../core/i18n';
import { canReserveSpecial, dayIsOpen, firstSpecialDate, specialSlots } from '../core/ordering';
import { Shop } from '../core/shop';
import { ClosedNotice } from './closed-notice';

/** Longueur maximale du champ details acceptée par firestore.rules */
const MAX_DETAILS = 2000;
/** Mobile algérien : 05, 06 ou 07 suivi de 8 chiffres, requis pour la confirmation WhatsApp */
const PHONE = /^0[567]\d{8}$/;

@Component({
  selector: 'app-checkout',
  imports: [Suggest, ClosedNotice, FormsModule, RouterLink],
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
                <div class="modes" [class.second]="mode() === 'livraison'" role="radiogroup" [attr.aria-label]="i18n.t('modeTitle')">
                  <span class="mode-slider" aria-hidden="true"></span>
                  <button type="button" class="mode-card" role="radio" [attr.aria-checked]="mode() === 'retrait'" [class.on]="mode() === 'retrait'" (click)="mode.set('retrait')">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10l1.5-5h13L20 10M4 10v10h16V10M4 10a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M10 20v-5h4v5" /></svg><span><b>{{ i18n.t('modePickup') }}</b><small>{{ i18n.t('modePickupHint') }}</small></span>
                  </button>
                  <button type="button" class="mode-card" role="radio" [attr.aria-checked]="mode() === 'livraison'" [class.on]="mode() === 'livraison'" (click)="mode.set('livraison')">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 7h12v10H2zM14 10h4l4 4v3h-8zM6.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg><span><b>{{ i18n.t('modeDelivery') }}</b><small>{{ feeLabel(cost()) }}</small></span>
                  </button>
                </div>
              } @else {
                <p class="serve-line"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 7h12v10H2zM14 10h4l4 4v3h-8zM6.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg>{{ i18n.t(shop.pickupKey()) }}</p>
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
              @if (hasSpecial()) {
                <p class="special-note">{{ i18n.t('specialCheckout') }}</p>
                @if (!shop.ordering().open && canSend()) { <p class="special-note">{{ i18n.t('specialNight') }}</p> }
                <label>{{ i18n.t(mode() === 'livraison' ? 'deliveryDate' : 'pickupDate') }}<input required name="date" type="date" [min]="minSpecialDate()" [ngModel]="specialDate()" (ngModelChange)="chooseSpecialDate($event)"></label>
                <div class="pick-group">
                  <span class="pick-label">{{ i18n.t('chooseSlot') }}</span>
                  <div class="chips small">
                    @for (s of slots(); track s) {
                      <button type="button" class="chip" [class.on]="slot() === s" (click)="slot.set(s)">{{ s }}</button>
                    } @empty { <small>{{ i18n.t('noSlot') }}</small> }
                  </div>
                </div>
              } @else {
                <label>{{ i18n.t(mode() === 'livraison' ? 'deliveryDate' : 'pickupDate') }}<input required name="date" type="date" [min]="today" [(ngModel)]="form.date"></label>
              }
              <label class="optin"><input type="checkbox" name="marketing" [(ngModel)]="form.marketing"> <span>{{ i18n.t('marketing') }}</span></label>
              <label>{{ i18n.t('notes') }}<textarea name="notes" [(ngModel)]="form.notes"></textarea></label>
              @if (error()) { <div class="form-error" role="alert">{{ error() }}</div> }
              @if (!canSend()) { <app-closed-notice /> }
              <button class="btn btn-red block" type="submit" [disabled]="f.invalid || sending() || !canSend()">
                {{ !canSend() ? i18n.t('closedBtn') : sending() ? i18n.t('sending') : i18n.t('sendOrder') }}
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
                <div class="sum-line"><span>{{ i18n.t('subtotal') }}</span><b>{{ i18n.total(cart.total(), cart.pending()) }}</b></div>
                <div class="sum-line"><span>{{ i18n.t('delivery') }}</span><b>{{ feeLabel(fee()) }}</b></div>
                @if (freeLeft() > 0) { <p class="serve-line"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7C10 3 7 3 7 5s3 2 5 2zM12 7c2-4 5-4 5-2s-3 2-5 2z" /></svg>{{ freeLeftText() }}</p> }
              }
              <div class="sum"><span>{{ i18n.t('total') }}</span><b>{{ i18n.total(grandTotal(), cart.pending()) }}</b></div>
              @if (cart.specialPriced()) { <p class="note">{{ i18n.t('finalPrice') }}</p> }
              <p class="note">{{ i18n.t(cart.pending() ? 'pendingPrice' : 'estimate') }}</p>
              @if (earn() > 0) { <p class="loyalty-earn">{{ i18n.t('loyaltyEarn').replace('{n}', '' + earn()) }}</p> }
              <app-suggest />
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
  protected form = { name: '', tel: '', zone: '', address: '', date: this.today, notes: '', marketing: false };
  protected readonly mode = signal<'retrait' | 'livraison'>('retrait');
  protected readonly hasSpecial = computed(() => this.cart.lines().some(l => l.special));
  protected readonly minSpecialDate = computed(() => firstSpecialDate(this.shop.orderingRules(), this.shop.clock()));
  /** Une réservation spéciale reste possible la nuit, sauf fermeture manuelle */
  protected readonly canSend = computed(() => this.shop.ordering().open || (this.hasSpecial() && canReserveSpecial(this.shop.orderingRules())));
  private readonly pickedDate = signal('');
  protected readonly specialDate = computed(() => this.pickedDate() || this.minSpecialDate());
  protected readonly slot = signal('');
  protected readonly slots = computed(() => specialSlots(this.shop.orderingRules(), this.specialDate(), this.shop.clock()));

  /** Frais si le client choisit la livraison */
  protected readonly cost = computed(() => deliveryCost(this.shop.settings(), this.cart.total()));
  protected readonly fee = computed(() => (this.mode() === 'livraison' ? this.cost() : 0));
  /** Points gagnés quand la commande sera remise au client */
  protected readonly earn = computed(() => {
    const s = this.shop.settings();
    return s.loyaltyEnabled ? pointsFor(this.cart.total(), s.loyaltyEvery) : 0;
  });
  protected readonly grandTotal = computed(() => this.cart.total() + this.fee());
  /** Ce qu'il manque au panier pour une livraison offerte */
  protected readonly freeLeft = computed(() => {
    const s = this.shop.settings();
    return s.deliveryFreeFrom > 0 && s.deliveryFee > 0 ? s.deliveryFreeFrom - this.cart.total() : 0;
  });

  protected chooseSpecialDate(date: string) {
    this.pickedDate.set(date);
    this.slot.set('');
  }

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
      l.origin ? this.i18n.country(l.origin) : '',
    ].filter(Boolean).join(' · ');
  }

  /** Articles de la commande, pour le stock et la facture */
  private items(): OrderItem[] {
    return this.cart.lines().map(l => ({
      productId: l.productId, unit: l.unit, qty: l.qty, name_fr: l.name_fr, name_ar: l.name_ar, price: l.price, total: lineTotal(l),
      ...(l.grams ? { grams: l.grams } : {}),
      ...(l.option_fr ? { option_fr: l.option_fr, option_ar: l.option_ar ?? l.option_fr } : {}),
      ...(l.origin ? { origin: l.origin } : {}),
      ...(l.special ? { special: true } : {}),
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
    this.shop.refreshClock();
    if (!this.canSend()) return;
    const special = this.hasSpecial();
    const date = special ? this.specialDate() : f.date;
    if (!dayIsOpen(this.shop.orderingRules(), date)) {
      this.error.set(t('dayClosed'));
      return;
    }
    // Recalculé ici : le créneau choisi a pu passer pendant que le client remplissait le formulaire
    if (special && !specialSlots(this.shop.orderingRules(), date, this.shop.clock()).includes(this.slot())) {
      this.error.set(t('slotRequired'));
      return;
    }
    const slotText = special ? `${t('slotLabel')} : ${date} ${this.slot()}` : '';
    const lines = this.cart.lines().map(l =>
      `- ${l.qty} × ${this.describe(l)} : ${l.unit === 'order' ? t('toConfirm') : this.i18n.money(lineTotal(l))}`);
    const delivery = this.mode() === 'livraison';
    const total = this.i18n.total(this.grandTotal(), this.cart.pending());
    const details = [
      ...lines,
      delivery && `${t('delivery')} : ${this.feeLabel(this.fee())}`,
      `${t('total')} : ${total}`,
      special && `${t('specialOrder')} · ${slotText}`,
      delivery && `${t('address')} : ${f.zone} — ${f.address.trim()}`,
      f.notes.trim() && `${t('notes')} : ${f.notes.trim()}`,
    ].filter(Boolean).join('\n').slice(0, MAX_DETAILS);

    this.sending.set(true);
    this.error.set('');
    try {
      this.ref.set(await this.shop.createOrder({
        name: f.name.trim(), tel, type: this.mode(), date, details, lang: this.i18n.lang(), items: this.items(),
        ...(f.marketing ? { marketing: true } : {}), delivery: this.fee(), total: this.grandTotal(), ...(delivery ? { address: `${f.zone} — ${f.address.trim()}`, zone: f.zone } : {}),
        typeLabel: `${special ? `${t('specialOrder')} ${this.slot()} · ` : ''}${t('basket')} · ${this.cart.count()} ${t('articles')} · ${total}`,
      }));
      this.cart.remember();
      this.cart.clear();
    } catch (err) {
      console.error('Commande non enregistrée', err);
      this.error.set(t('orderFail'));
    } finally {
      this.sending.set(false);
    }
  }
}
