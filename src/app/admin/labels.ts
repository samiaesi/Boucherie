import { Component, OnDestroy, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category, formatNumber, orderRef } from '../core/data';
import { localDay } from '../core/stats';
import { AdminData } from './admin-data';
import { Label, labelsFromOrder, manualLabel, morningLabels } from './labels-data';

type Format = 'thermal' | 'a4';

const COUNTS_KEY = 'ticketCounts';

function savedCounts(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(COUNTS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

const PAGE_STYLE: Record<Format, string> = {
  thermal: '@page { size: 60mm 40mm; margin: 0; }',
  a4: '@page { size: A4; margin: 8mm; }',
};

@Component({
  selector: 'app-labels',
  imports: [FormsModule],
  template: `
    <div class="no-print">
      <div class="head">
        <h2>Étiquettes</h2>
        <div class="chips">
          <button class="chip" [class.active]="mode() === 'morning'" (click)="mode.set('morning')">Tickets du matin</button>
          <button class="chip" [class.active]="mode() === 'order'" (click)="mode.set('order')">Pour une commande</button>
          <button class="btn" [disabled]="!labels().length" (click)="print()">Imprimer ({{ labels().length }})</button>
        </div>
      </div>

      <div class="card-box setup">
        <div class="grid2">
          @if (mode() === 'order') {
            <label>Commande
              <select name="order" [ngModel]="orderId()" (ngModelChange)="orderId.set($event)">
                <option value="">Aucune</option>
                @for (o of activeOrders(); track o.id) { <option [value]="o.id">{{ ref(o.id) }} · {{ o.name }}</option> }
              </select>
            </label>
          } @else {
            <label>Rayon
              <select name="rayon" [ngModel]="rayon()" (ngModelChange)="rayon.set($event)">
                <option value="">Tous les rayons</option>
                @for (c of categories(); track c.id) { <option [value]="c.id">{{ c.name_fr }}</option> }
              </select>
            </label>
          }
          <label>Format
            <select name="format" [ngModel]="format()" (ngModelChange)="format.set($event)">
              <option value="thermal">Imprimante à étiquettes (60 × 40 mm)</option>
              <option value="a4">Feuille A4 (planche d'étiquettes)</option>
            </select>
          </label>
          <label>{{ mode() === 'morning' ? 'Date du ticket' : 'Emballé le' }}<input name="packed" type="date" [ngModel]="packed()" (ngModelChange)="packed.set($event)"></label>
          <label>À consommer jusqu'au<input name="useBy" type="date" [ngModel]="useBy()" (ngModelChange)="useBy.set($event)"></label>
        </div>
        @if (mode() === 'morning') {
          <div class="counts">
            @for (p of morningProducts(); track p.id) {
              <label class="count" [class.on]="counts()[p.id]">
                <span>{{ p.name_fr }}</span>
                <input type="number" min="0" placeholder="0" [attr.aria-label]="'Nombre de tickets ' + p.name_fr"
                       [value]="counts()[p.id] || ''" (input)="setCount(p.id, $any($event.target).value)">
              </label>
            }
          </div>
          <div><button class="btn light small" [disabled]="!morning().length" (click)="clearCounts()">Tout remettre à zéro</button></div>
        } @else {
        <div class="manual">
          <label>Ajouter à la main
            <select name="product" [ngModel]="productId()" (ngModelChange)="productId.set($event)">
              <option value="">Choisir un produit…</option>
              @for (p of data.products(); track p.id) { <option [value]="p.id">{{ p.name_fr }}</option> }
            </select>
          </label>
          <label>Poids (g)<input name="grams" type="number" min="0" step="50" [ngModel]="grams()" (ngModelChange)="grams.set(+$event || 0)"></label>
          <label>Nombre<input name="copies" type="number" min="1" [ngModel]="copies()" (ngModelChange)="copies.set(+$event || 1)"></label>
          <button class="btn light" [disabled]="!productId()" (click)="addManual()">Ajouter</button>
        </div>
        <label class="check"><input type="checkbox" name="prices" [ngModel]="showPrice()" (ngModelChange)="showPrice.set($event)"> Afficher le prix</label>
        }
      </div>
    </div>

    @if (labels().length) {
      <div class="sheet" [class.a4]="format() === 'a4'" [class.thermal]="format() === 'thermal'">
        @for (l of labels(); track $index) {
          <article class="label" [class.simple]="l.simple">
            <header>
              <img src="logo.svg" alt="">
              <div><b>{{ shop().name_fr }}</b><small>{{ shop().phone }}</small></div>
              <span class="halal">حلال</span>
            </header>
            <div class="name"><b>{{ l.name_fr }}</b><span dir="rtl">{{ l.name_ar }}</span></div>
            @if (l.simple) {
              <div class="ticket-date">{{ short(packed()) }}</div>
            }
            @if (l.detail) { <small class="detail">{{ l.detail }}</small> }
            <div class="numbers">
              @if (l.weight) { <b>{{ l.weight }}</b> }
              @if (showPrice() && l.amount) { <b>{{ num(l.amount) }} DA</b> }
            </div>
            @if (showPrice() && l.priceKg) { <small>{{ num(l.priceKg) }} DA/kg</small> }
            <footer>
              @if (packed() && !l.simple) { <span>Emballé : {{ short(packed()) }}</span> }
              @if (useBy()) { <span><b>DLC : {{ short(useBy()) }}</b></span> }
              @if (l.ref) { <span>{{ l.ref }} · {{ l.client }}</span> }
            </footer>
          </article>
        }
      </div>
    } @else {
      <div class="empty no-print">{{ mode() === 'morning' ? 'Indiquez le nombre de tickets pour chaque produit.' : 'Choisissez une commande ou ajoutez un produit à la main.' }}</div>
    }
  `,
  styles: `
    .setup { max-width: 860px; margin-bottom: 18px; }
    .manual { display: grid; grid-template-columns: 2fr 110px 90px auto; gap: 10px; align-items: end; }
    .counts { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; max-height: 340px; overflow-y: auto; }
    .count { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 10px; color: var(--ink); font-weight: 500; }
    .count.on { border-color: var(--bordeaux); background: #fbf1f2; }
    .count input { width: 72px; padding: 6px 8px; }
    .label.simple .name { flex-direction: column; align-items: center; gap: 0; margin-top: 1.5mm; font-size: 14pt; line-height: 1.1; text-align: center; }
    .ticket-date { margin-top: auto; text-align: center; font-size: 15pt; font-weight: 800; }
    .sheet { display: flex; flex-wrap: wrap; gap: 10px; }
    .label { display: flex; flex-direction: column; width: 60mm; height: 40mm; padding: 2mm 2.5mm; overflow: hidden; border: 1px dashed #bbb; background: #fff; color: #000; font-family: Inter, Cairo, sans-serif; font-size: 7.5pt; line-height: 1.15; }
    .label header { display: flex; align-items: center; gap: 1.5mm; }
    .label header img { width: 6mm; height: 6mm; }
    .label header div { flex: 1; min-width: 0; }
    .label header b { display: block; font-size: 7.5pt; }
    .label small { font-size: 6.5pt; }
    .halal { padding: .3mm 1.5mm; border: .3mm solid #000; font-family: Cairo, sans-serif; font-weight: 800; }
    .name { display: flex; justify-content: space-between; gap: 2mm; margin-top: 1mm; font-size: 10pt; font-weight: 700; font-family: Inter, Cairo, sans-serif; }
    .name span { font-family: Cairo, sans-serif; }
    .numbers { display: flex; justify-content: space-between; margin-top: .5mm; font-size: 11pt; }
    .label footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0 2mm; margin-top: auto; font-size: 6.5pt; }
    @media (max-width: 700px) { .manual { grid-template-columns: 1fr 1fr; } }
    @media print {
      .no-print { display: none; }
      .sheet { gap: 0; }
      .label { border: 0; }
      .sheet.thermal .label { break-after: page; }
      .sheet.a4 .label { border: 1px dashed #bbb; break-inside: avoid; }
    }
  `,
})
export class Labels implements OnDestroy {
  protected readonly data = inject(AdminData);
  /** Paramètre d'URL ?order= */
  readonly order = input<string>();
  protected readonly mode = signal<'morning' | 'order'>('morning');
  protected readonly rayon = signal('');
  protected readonly categories = signal<Category[]>([]);
  protected readonly counts = signal<Record<string, number>>(savedCounts());
  protected readonly orderId = signal('');
  protected readonly format = signal<Format>('thermal');
  protected readonly packed = signal(localDay(new Date()));
  protected readonly useBy = signal('');
  protected readonly showPrice = signal(true);
  protected readonly productId = signal('');
  protected readonly grams = signal(500);
  protected readonly copies = signal(1);
  private readonly manual = signal<Label[]>([]);
  protected readonly num = formatNumber;
  protected readonly ref = orderRef;
  protected readonly shop = this.data.settings;
  private readonly pageStyle = document.createElement('style');

  protected readonly activeOrders = computed(() =>
    this.data.orders().filter(o => !['annulé', 'récupéré', 'livré'].includes(o.status)));

  protected readonly morningProducts = computed(() => {
    const r = this.rayon();
    return this.data.products().filter(p => p.available !== false && (!r || p.category === r));
  });
  protected readonly morning = computed(() => morningLabels(this.data.products(), this.counts()));

  protected readonly labels = computed(() => {
    if (this.mode() === 'morning') return this.morning();
    const o = this.data.orders().find(x => x.id === this.orderId());
    return [...(o ? labelsFromOrder(o) : []), ...this.manual()];
  });

  constructor() {
    document.head.append(this.pageStyle);
    effect(() => { this.pageStyle.textContent = PAGE_STYLE[this.format()]; });
    effect(() => {
      const id = this.order();
      if (id) {
        this.orderId.set(id);
        this.mode.set('order');
      }
    });
    this.data.getCategories().then(list => this.categories.set(list));
  }

  /** Les nombres sont gardés d'un matin à l'autre sur cet ordinateur. */
  protected setCount(id: string, value: string) {
    this.saveCounts({ ...this.counts(), [id]: Math.max(0, Math.floor(Number(value)) || 0) });
  }

  protected clearCounts() {
    this.saveCounts({});
  }

  private saveCounts(counts: Record<string, number>) {
    this.counts.set(counts);
    try { localStorage.setItem(COUNTS_KEY, JSON.stringify(counts)); } catch {}
  }

  ngOnDestroy() {
    this.pageStyle.remove();
  }

  protected addManual() {
    const p = this.data.products().find(x => x.id === this.productId());
    if (!p) return;
    const label = manualLabel(p, this.grams());
    this.manual.update(list => [...list, ...Array.from({ length: Math.max(1, this.copies()) }, () => label)]);
  }

  protected short(day: string) {
    return `${day.slice(8)}/${day.slice(5, 7)}/${day.slice(2, 4)}`;
  }

  protected print() {
    window.print();
  }
}
