import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category, Product, availableOrigins, byOrder, formatNumber, isOutOfStock, applyPools, originsOf } from '../core/data';
import { TicketLine, lineAmount, lineTotal, newLine, priceFor, ticketItems, ticketTotal } from '../core/counter';
import { searchProducts } from '../core/product-search';
import { localDay } from '../core/stats';
import { AdminData } from './admin-data';

@Component({
  selector: 'app-counter',
  imports: [FormsModule],
  template: `
    <div class="head"><h2>Caisse comptoir</h2></div>
    <div class="pos">
      <section class="catalog">
        <div class="finder">
          <input type="search" placeholder="Chercher un produit…" aria-label="Chercher un produit" [ngModel]="search()" (ngModelChange)="search.set($event)" name="search">
        </div>
        <div class="chips">
          <button type="button" [class.on]="!rayon()" (click)="rayon.set('')">Tout</button>
          @for (c of categories(); track c.id) { <button type="button" [class.on]="rayon() === c.id" (click)="rayon.set(c.id)">{{ c.name_fr }}</button> }
        </div>
        <div class="grid">
          @for (p of shown(); track p.id) {
            <button type="button" class="tile" [class.out]="isOut(p)" (click)="add(p)">
              @if (p.image) { <img [src]="p.image" alt=""> }
              <b>{{ p.name_fr }}</b>
              <small>{{ money(priceFor(p)) }} {{ p.unit === 'kg' ? '/ kg' : '/ pièce' }}{{ isOut(p) ? ' · rupture' : '' }}</small>
            </button>
          } @empty { <p class="empty">Aucun produit.</p> }
        </div>
      </section>

      <aside class="ticket">
        <h3>Ticket</h3>
        @for (l of lines(); track l.key) {
          <div class="tline">
            <div class="tname"><b>{{ l.product.name_fr }}</b>
              <button type="button" class="x" [attr.aria-label]="'Retirer ' + l.product.name_fr" (click)="remove(l)">✕</button></div>
            <div class="tfields">
              @if (l.product.unit === 'kg') {
                <label>Poids (g)<input type="number" min="1" step="10" [ngModel]="l.grams" (ngModelChange)="patch(l, { grams: +$event })" [name]="'g' + l.key"></label>
              } @else {
                <label>Pièces<input type="number" min="1" step="1" [ngModel]="l.qty" (ngModelChange)="patch(l, { qty: +$event })" [name]="'q' + l.key"></label>
              }
              @if (countries(l.product).length > 1) {
                <label>Pays
                  <select [ngModel]="l.origin" (ngModelChange)="patch(l, { origin: $event, price: priceFor(l.product, $event) })" [name]="'o' + l.key">
                    @for (c of countries(l.product); track c) { <option [value]="c">{{ c }}</option> }
                  </select>
                </label>
              }
              <label>Prix (DA)<input type="number" min="0" step="10" [ngModel]="l.price" (ngModelChange)="patch(l, { price: +$event })" [name]="'p' + l.key"></label>
            </div>
            <div class="tsum"><span>{{ amount(l) }}</span><b>{{ money(total(l)) }}</b></div>
          </div>
        } @empty {
          <p class="empty">Touchez un produit pour l'ajouter.</p>
        }
        <div class="grand"><span>Total</span><b>{{ money(grand()) }}</b></div>
        @if (data.settings().loyaltyEnabled) {
          <label class="tel">Téléphone du client (fidélité, facultatif)<input type="tel" inputmode="tel" placeholder="0555 12 34 56" [ngModel]="tel()" (ngModelChange)="tel.set($event)" name="tel"></label>
        }
        @if (error()) { <div class="msg">{{ error() }}</div> }
        <button class="btn pay" [disabled]="!lines().length || busy()" (click)="pay()">{{ busy() ? 'Encaissement…' : 'Encaisser ' + money(grand()) }}</button>
        @if (lines().length) { <button type="button" class="btn light small clear" (click)="lines.set([])">Vider le ticket</button> }
        @if (last(); as t) {
          <div class="done">
            <b>Vente enregistrée ✓</b>
            <span>{{ money(t.total) }}{{ t.points ? ' · +' + t.points + ' points de fidélité' : '' }}</span>
            <button type="button" class="btn light small" (click)="print(t)">Imprimer le ticket</button>
          </div>
        }
      </aside>
    </div>
  `,
  styles: `
    .pos { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 18px; align-items: start; }
    .finder input { max-width: 420px; }
    .chips { display: flex; gap: 6px; overflow-x: auto; margin: 10px 0; padding-bottom: 4px; }
    .chips button { flex: none; padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; background: #fff; font: inherit; font-size: .84rem; cursor: pointer; }
    .chips button.on { background: #1d1613; border-color: #1d1613; color: #fff; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
    .tile { display: grid; gap: 3px; padding: 8px; text-align: start; background: #fff; border: 1px solid var(--line); border-radius: 12px; font: inherit; cursor: pointer; transition: transform .15s, border-color .15s; }
    .tile:hover { transform: translateY(-2px); border-color: #a10c20; }
    .tile:active { transform: scale(.97); }
    .tile img { width: 100%; height: 72px; object-fit: cover; border-radius: 8px; }
    .tile b { font-size: .86rem; line-height: 1.2; }
    .tile small { color: var(--muted); font-size: .74rem; }
    .tile.out { opacity: .5; }
    .ticket { position: sticky; top: 12px; display: grid; gap: 10px; padding: 16px; background: #fff; border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 14px 30px -22px rgba(0, 0, 0, .35); }
    .ticket h3 { margin: 0; font-family: Inter, sans-serif; font-size: 1.05rem; }
    .tline { display: grid; gap: 6px; padding-bottom: 10px; border-bottom: 1px dashed var(--line); }
    .tname { display: flex; justify-content: space-between; gap: 8px; }
    .x { border: 0; background: none; color: #a10c20; cursor: pointer; }
    .tfields { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 6px; }
    .tfields label { margin: 0; font-size: .74rem; }
    .tfields input, .tfields select { padding: 6px 8px; }
    .tsum { display: flex; justify-content: space-between; color: var(--muted); font-size: .86rem; }
    .tsum b { color: var(--ink); }
    .grand { display: flex; justify-content: space-between; align-items: baseline; font-size: 1.05rem; }
    .grand b { font-size: 1.5rem; }
    .tel { margin: 0; font-size: .8rem; }
    .pay { padding: 14px; font-size: 1.05rem; }
    .clear { justify-self: center; }
    .done { display: grid; gap: 4px; justify-items: start; padding: 10px 12px; border-radius: 10px; background: #e9f6ee; color: #17603a; }
    .empty { color: var(--muted); }
    @media (max-width: 900px) { .pos { grid-template-columns: 1fr; } .ticket { position: static; } }
  `,
})
export class Counter implements OnInit {
  protected readonly data = inject(AdminData);
  protected readonly categories = signal<Category[]>([]);
  protected readonly search = signal('');
  protected readonly rayon = signal('');
  protected readonly lines = signal<TicketLine[]>([]);
  protected readonly tel = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly last = signal<{ id: string; total: number; points: number; lines: TicketLine[]; at: Date } | null>(null);
  protected readonly priceFor = priceFor;
  protected readonly amount = lineAmount;
  protected readonly total = lineTotal;
  private nextKey = 1;

  private readonly sellable = computed(() =>
    applyPools([...this.data.products()].sort(byOrder), this.data.fridge()).filter(p => p.available && p.unit !== 'order' && !p.custom));
  protected readonly shown = computed(() => searchProducts(this.sellable(), p => p, this.search(), this.rayon(), this.categories()));
  protected readonly grand = computed(() => ticketTotal(this.lines()));

  async ngOnInit() {
    this.categories.set(await this.data.getCategories());
  }

  protected money(n: number) {
    return `${formatNumber(Math.round(n))} DA`;
  }

  protected isOut(p: Product) {
    return isOutOfStock(p);
  }

  protected countries(p: Product) {
    return (availableOrigins(p).length ? availableOrigins(p) : originsOf(p)).map(o => o.country);
  }

  protected add(p: Product) {
    this.last.set(null);
    this.lines.update(list => [...list, newLine(p, this.nextKey++)]);
  }

  protected patch(l: TicketLine, change: Partial<TicketLine>) {
    this.lines.update(list => list.map(x => (x.key === l.key ? { ...x, ...change } : x)));
  }

  protected remove(l: TicketLine) {
    this.lines.update(list => list.filter(x => x.key !== l.key));
  }

  protected async pay() {
    const lines = this.lines();
    const items = ticketItems(lines);
    if (!items.length) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const total = ticketTotal(lines);
      const { id, points } = await this.data.counterSale(items, total, this.tel(), localDay(new Date()));
      this.last.set({ id, total, points, lines, at: new Date() });
      this.lines.set([]);
      this.tel.set('');
      this.data.notify(`Vente enregistrée : ${this.money(total)}`);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  /** Ticket de caisse imprimable (imprimante de ticket ou A4) */
  protected print(t: { total: number; lines: TicketLine[]; at: Date }) {
    const s = this.data.settings();
    const rows = t.lines.map(l => `<tr><td>${l.product.name_fr}${l.origin ? ` (${l.origin})` : ''}<br><small>${lineAmount(l)} × ${formatNumber(l.price)} DA</small></td><td>${formatNumber(lineTotal(l))} DA</td></tr>`).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!doctype html><meta charset="utf-8"><title>Ticket</title>
      <style>body{font:14px/1.4 monospace;width:280px;margin:10px auto}h1{font-size:16px;text-align:center;margin:0}p{text-align:center;margin:2px 0}table{width:100%;border-collapse:collapse;margin:10px 0}td{padding:4px 0;border-bottom:1px dashed #999;vertical-align:top}td+td{text-align:right;white-space:nowrap}.t{font-size:18px;font-weight:bold;text-align:right}</style>
      <h1>${s.name_fr}</h1><p>${s.address_fr}</p><p>${t.at.toLocaleString('fr-FR')}</p>
      <table>${rows}</table><p class="t">TOTAL ${formatNumber(t.total)} DA</p><p>Merci de votre visite !</p>
      <script>print()<\/script>`);
    win.document.close();
  }
}
