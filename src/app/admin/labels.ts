import { Component, OnDestroy, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category, formatNumber, orderRef } from '../core/data';
import { IconPipe } from '../core/icon';
import { localDay } from '../core/stats';
import { AdminData } from './admin-data';
import { DEFAULT_LABEL_FIELDS, DEFAULT_LABEL_SIZE, LABEL_SIZES, Label, LabelFields, LabelSize, a4Layout, labelDates, clampSize, labelScale, labelsFromOrder, manualLabel, morningLabels } from './labels-data';

type Format = 'thermal' | 'a4';

const COUNTS_KEY = 'ticketCounts';
const SIZE_KEY = 'ticketSize';
const FIELDS_KEY = 'ticketFields';

function savedFields(): LabelFields {
  try {
    return { ...DEFAULT_LABEL_FIELDS, ...JSON.parse(localStorage.getItem(FIELDS_KEY) ?? '{}') };
  } catch {
    return DEFAULT_LABEL_FIELDS;
  }
}

const FIELD_NAMES: [keyof LabelFields, string][] = [
  ['company', "Nom de l'entreprise"], ['rayon', 'Pictogramme du rayon'], ['weight', 'Poids'], ['origin', "Pays d'origine"],
  ['date', 'Date'], ['arrival', "Date d'arrivage"], ['expiry', "Date d'expiration"],
];

function savedSize(): LabelSize {
  try {
    return clampSize({ ...DEFAULT_LABEL_SIZE, ...JSON.parse(localStorage.getItem(SIZE_KEY) ?? '{}') });
  } catch {
    return DEFAULT_LABEL_SIZE;
  }
}

function savedCounts(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(COUNTS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

const pageStyle = (format: Format, s: LabelSize) =>
  (format === 'a4' ? '@page { size: A4; margin: 8mm; }' : `@page { size: ${s.w}mm ${s.h}mm; margin: 0; }`);

@Component({
  selector: 'app-labels',
  imports: [FormsModule, IconPipe],
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
              <option value="a4">Feuille A4 à découper</option>
              <option value="thermal">Imprimante à étiquettes</option>
            </select>
          </label>
          <label>Taille du ticket
            <select name="sizeChoice" [ngModel]="sizeChoice()" (ngModelChange)="chooseSize($event)">
              @for (s of sizes; track s.w + 'x' + s.h) {
                <option [value]="s.w + 'x' + s.h">{{ s.w }} × {{ s.h }} mm{{ format() === 'a4' ? ' · ' + perPage(s) + ' par page' : '' }}</option>
              }
              <option value="custom">Taille personnalisée</option>
            </select>
          </label>
          @if (sizeChoice() === 'custom') {
            <div class="custom">
              <label>Largeur (mm)<input name="w" type="number" min="30" max="194" [ngModel]="size().w" (ngModelChange)="setSize({ w: +$event, h: size().h })"></label>
              <label>Hauteur (mm)<input name="h" type="number" min="20" max="281" [ngModel]="size().h" (ngModelChange)="setSize({ w: size().w, h: +$event })"></label>
            </div>
          }
          <label>{{ mode() === 'morning' ? 'Date du ticket' : 'Emballé le' }}<input name="packed" type="date" [ngModel]="packed()" (ngModelChange)="packed.set($event)"></label>
          <label>Date d'arrivage<input name="arrival" type="date" [ngModel]="arrival()" (ngModelChange)="arrival.set($event)"></label>
          <label>Date d'expiration<input name="useBy" type="date" [ngModel]="useBy()" (ngModelChange)="useBy.set($event)"></label>
          @if (mode() === 'morning') {
            <label>Poids du ticket (g)<input name="ticketGrams" type="number" min="0" step="50" placeholder="Vide : à écrire à la main" [ngModel]="ticketGrams()" (ngModelChange)="ticketGrams.set(+$event || 0)"></label>
          }
        </div>
        <fieldset class="fields">
          <legend>Afficher sur le ticket</legend>
          @for (f of fieldNames; track f[0]) {
            <label class="check"><input type="checkbox" [name]="'f-' + f[0]" [ngModel]="fields()[f[0]]" (ngModelChange)="setField(f[0], $event)"> {{ f[1] }}</label>
          }
        </fieldset>
        @if (format() === 'a4') {
          <div class="print-info">
            <label class="check"><input type="checkbox" name="cuts" [ngModel]="cuts()" (ngModelChange)="cuts.set($event)"> Imprimer les traits de découpe</label>
            <span>{{ layout().columns }} colonnes × {{ layout().rows }} lignes · {{ layout().perPage }} tickets par page@if (labels().length) { · {{ layout().pages }} page(s)}</span>
          </div>
        }
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
      <div class="sheet" [class.a4]="format() === 'a4'" [class.thermal]="format() === 'thermal'" [class.cut]="format() === 'a4' && cuts()"
           [style.--w]="size().w" [style.--h]="size().h" [style.--s]="scale()" [style.--cols]="layout().columns">
        @for (l of labels(); track $index) {
          <article class="label" [class.simple]="l.simple">
            <header>
              <img src="logo.svg" alt="">
              <div><b>{{ shop().name_fr }}</b><small>{{ fields().company ? shop().company : shop().phone }}</small></div>
              @if (fields().rayon && rayonIcon(l); as icon) { <span class="rayon-ico" [innerHTML]="icon | icon"></span> }
              <span class="halal">حلال</span>
            </header>
            <div class="name"><b>{{ l.name_fr }}</b><span dir="rtl">{{ l.name_ar }}</span></div>
            @if (l.detail) { <small class="detail">{{ l.detail }}</small> }
            @if (fields().origin && l.origin) { <small class="origin">Origine : {{ l.origin }}</small> }
            <div class="numbers">
              @if (fields().weight) {
                @if (weightOf(l); as w) { <b>{{ w }}</b> } @else { <span class="blank">Poids : ............ kg</span> }
              }
              @if (showPrice() && l.amount) { <b>{{ num(l.amount) }} DA</b> }
            </div>
            @if (showPrice() && l.priceKg) { <small>{{ num(l.priceKg) }} DA/kg</small> }
            <div class="facts">
              @for (d of dates(); track d.label) { <span><small>{{ d.label }}</small><b>{{ d.value }}</b></span> }
            </div>
            @if (l.ref) { <footer><span>{{ l.ref }} · {{ l.client }}</span></footer> }
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
    .label.simple .name { flex-direction: column; align-items: center; gap: 0; font-size: 13pt; line-height: 1.12; text-align: center; }
    .label.simple .numbers { justify-content: center; font-size: 13pt; }
    .fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 6px; padding: 10px; border: 1px solid var(--line); border-radius: 10px; }
    .fields legend { padding: 0 6px; color: var(--muted); font-size: .85rem; font-weight: 600; }
    .rayon-ico { flex: none; display: block; width: 6.5mm; height: 6.5mm; }
    .rayon-ico :is(svg) { display: block; width: 100%; height: 100%; }
    .blank { font-size: 8pt; font-weight: 600; }
    .label .origin { text-align: center; font-weight: 600; }
    .facts { display: flex; justify-content: space-evenly; gap: 1.5mm; margin-top: auto; padding-top: .8mm; border-top: .2mm solid #000; }
    .facts span { min-width: 0; text-align: center; }
    .facts small { display: block; font-size: 5.5pt; line-height: 1.1; }
    .facts b { display: block; font-size: 8pt; white-space: nowrap; }
    .custom { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .print-info { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; color: var(--muted); font-size: .88rem; }
    .sheet { display: flex; flex-wrap: wrap; gap: 10px; }
    .sheet.a4 { display: grid; grid-template-columns: repeat(var(--cols), calc(var(--w) * 1mm)); grid-auto-rows: calc(var(--h) * 1mm); gap: 0; width: max-content; max-width: 100%; overflow-x: auto; background: #fff; }
    .sheet.a4 .label { border: 0; }
    .sheet.cut .label { outline: .3mm dashed #333; outline-offset: -.15mm; }
    .label { box-sizing: border-box; display: flex; flex-direction: column; zoom: var(--s); width: calc(var(--w) * 1mm / var(--s)); height: calc(var(--h) * 1mm / var(--s)); padding: 2mm 2.5mm; overflow: hidden; border: 1px dashed #bbb; background: #fff; color: #000; font-family: Inter, Cairo, sans-serif; font-size: 7.5pt; line-height: 1.15; }
    .label header { display: flex; align-items: center; gap: 1.5mm; }
    .label header img { width: 6mm; height: 6mm; }
    .label header div { flex: 1; min-width: 0; }
    .label header b { display: block; font-size: 7.5pt; }
    .label small { font-size: 6.5pt; }
    .halal { padding: .3mm 1.5mm; border: .3mm solid #000; font-family: Cairo, sans-serif; font-weight: 800; }
    .name { display: flex; justify-content: space-between; gap: 2mm; margin-top: auto; font-size: 10pt; font-weight: 700; font-family: Inter, Cairo, sans-serif; }
    .name span { font-family: Cairo, sans-serif; }
    .numbers { display: flex; justify-content: space-between; margin-top: .5mm; font-size: 11pt; }
    .label footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0 2mm; margin-top: auto; font-size: 6.5pt; }
    @media (max-width: 700px) { .manual { grid-template-columns: 1fr 1fr; } }
    @media print {
      .no-print { display: none; }
      .sheet { gap: 0; }
      .label { border: 0; }
      .sheet.thermal .label { break-after: page; }
      .sheet.a4 { width: auto; max-width: none; overflow: visible; }
      .sheet.a4 .label { break-inside: avoid; }
      .sheet.a4:not(.cut) .label { outline: 0; }
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
  protected readonly format = signal<Format>('a4');
  protected readonly sizes = LABEL_SIZES;
  protected readonly size = signal(savedSize());
  protected readonly customSize = signal(false);
  protected readonly cuts = signal(true);
  protected readonly scale = computed(() => labelScale(this.size()));
  protected readonly sizeChoice = computed(() => {
    const s = this.size();
    return !this.customSize() && LABEL_SIZES.some(x => x.w === s.w && x.h === s.h) ? `${s.w}x${s.h}` : 'custom';
  });
  protected readonly packed = signal(localDay(new Date()));
  protected readonly useBy = signal('');
  protected readonly arrival = signal('');
  protected readonly ticketGrams = signal(0);
  protected readonly fieldNames = FIELD_NAMES;
  protected readonly fields = signal(savedFields());
  protected readonly dates = computed(() => labelDates(this.fields(), { date: this.packed(), expiry: this.useBy(), arrival: this.arrival() }, d => this.short(d)));
  protected readonly showPrice = signal(true);
  protected readonly productId = signal('');
  protected readonly grams = signal(500);
  protected readonly copies = signal(1);
  private readonly manual = signal<Label[]>([]);
  protected readonly num = formatNumber;
  protected readonly ref = orderRef;
  protected readonly shop = this.data.settings;
  private readonly pageStyleTag = document.createElement('style');

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
    return [...(o ? labelsFromOrder(o, this.data.products()) : []), ...this.manual()];
  });

  constructor() {
    document.head.append(this.pageStyleTag);
    effect(() => { this.pageStyleTag.textContent = pageStyle(this.format(), this.size()); });
    effect(() => {
      const id = this.order();
      if (id) {
        this.orderId.set(id);
        this.mode.set('order');
      }
    });
    this.data.getCategories().then(list => this.categories.set(list));
  }

  protected readonly layout = computed(() => a4Layout(this.size(), this.labels().length));

  protected perPage(s: LabelSize) {
    return a4Layout(s, 0).perPage;
  }

  protected setField(key: keyof LabelFields, on: boolean) {
    const next = { ...this.fields(), [key]: on };
    this.fields.set(next);
    try { localStorage.setItem(FIELDS_KEY, JSON.stringify(next)); } catch {}
  }

  protected rayonIcon(l: Label) {
    return this.categories().find(c => c.id === l.category)?.icon;
  }

  /** Vide sur un ticket du matin sans poids saisi : la ligne s'écrit à la main. */
  protected weightOf(l: Label) {
    if (l.weight) return l.weight;
    const g = this.ticketGrams();
    return g ? (g >= 1000 ? `${formatNumber(g / 1000)} kg` : `${g} g`) : '';
  }

  protected chooseSize(choice: string) {
    this.customSize.set(choice === 'custom');
    if (choice === 'custom') return;
    const [w, h] = choice.split('x').map(Number);
    this.setSize({ w, h });
  }

  /** La taille est gardée sur cet ordinateur. */
  protected setSize(size: LabelSize) {
    const clean = clampSize(size);
    this.size.set(clean);
    try { localStorage.setItem(SIZE_KEY, JSON.stringify(clean)); } catch {}
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
    this.pageStyleTag.remove();
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
