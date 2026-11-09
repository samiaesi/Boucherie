import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category } from '../core/data';
import { CountLine, countLines, countSummary, gapOf } from '../core/inventory';
import { searchProducts } from '../core/product-search';
import { localDay } from '../core/stats';
import { AdminData } from './admin-data';

@Component({
  selector: 'app-inventory',
  imports: [FormsModule],
  template: `
    <div class="head"><h2>Inventaire du soir</h2></div>
    <p class="hint">Pesez ou comptez ce qui reste vraiment, et tapez-le. Laissez vide ce que vous n'avez pas compté. Un manque est enregistré en déstockage (« correction d'inventaire ») ; un surplus est simplement ajouté au stock.</p>

    <div class="finder">
      <input type="search" placeholder="Produit, rayon…" aria-label="Rechercher un produit" [ngModel]="search()" (ngModelChange)="search.set($event)" name="search">
      <select aria-label="Rayon" [ngModel]="rayon()" (ngModelChange)="rayon.set($event)" name="rayon">
        <option value="">Tous les rayons</option>
        @for (c of categories(); track c.id) { <option [value]="c.id">{{ c.name_fr }}</option> }
      </select>
    </div>

    <div class="count-list">
      @for (l of shown(); track l.key) {
        @let gap = gapOf(l, counts()[l.key]);
        <div class="count-row" [class.minus]="gap !== null && gap < 0" [class.plus]="gap !== null && gap > 0" [class.ok]="gap === 0">
          <div class="what">
            <b>{{ l.name }}</b>
            <small>À l'écran : {{ l.expected }} {{ l.unit }}</small>
          </div>
          <label class="field">
            <input type="number" min="0" step="0.1" inputmode="decimal" placeholder="Compté" [attr.aria-label]="'Quantité comptée de ' + l.name"
              [ngModel]="counts()[l.key]" (ngModelChange)="setCount(l, $event)" [name]="'c-' + l.key">
            <span>{{ l.unit }}</span>
          </label>
          <span class="gap">
            @if (gap === null) { — } @else if (gap === 0) { ✓ juste } @else { {{ gap > 0 ? '+' : '' }}{{ gap }} {{ l.unit }} }
          </span>
        </div>
      } @empty {
        <div class="empty">Aucun produit avec un stock suivi. Le stock d'un produit est suivi dès son premier arrivage ou sa première découpe.</div>
      }
    </div>

    <div class="count-bar">
      <span><b>{{ summary().done }}</b> ligne(s) comptée(s)</span>
      <span class="minus">Manque : <b>{{ summary().missing }}</b></span>
      <span class="plus">En trop : <b>{{ summary().extra }}</b></span>
      <span class="grow"></span>
      @if (error()) { <span class="msg">{{ error() }}</span> }
      <button class="btn" [disabled]="!changes() || busy()" (click)="apply()">{{ busy() ? 'Correction…' : 'Corriger le stock (' + changes() + ')' }}</button>
    </div>
  `,
  styles: `
    .hint { color: var(--muted); margin-bottom: 14px; max-width: 900px; }
    .finder { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 10px; max-width: 760px; margin-bottom: 12px; }
    .count-list { display: grid; gap: 6px; max-width: 900px; padding-bottom: 90px; }
    .count-row { display: grid; grid-template-columns: minmax(0, 1fr) 150px 110px; gap: 12px; align-items: center; padding: 10px 14px; background: #fff; border: 1px solid var(--line); border-radius: 12px; }
    .count-row.minus { border-color: #f1b6bf; background: #fff7f8; }
    .count-row.plus { border-color: #b9dcc6; background: #f5fbf7; }
    .count-row.ok { border-color: #b9dcc6; }
    .what b { display: block; }
    .what small { color: var(--muted); }
    .field { display: flex; align-items: center; gap: 6px; margin: 0; }
    .field input { width: 100%; font-size: 1.05rem; text-align: end; }
    .field span { color: var(--muted); font-size: .8rem; }
    .gap { text-align: end; font-weight: 700; color: var(--muted); }
    .minus .gap, .count-bar .minus b { color: #b3142c; }
    .plus .gap, .count-bar .plus b { color: #1f7a45; }
    .ok .gap { color: #1f7a45; }
    .count-bar { position: sticky; bottom: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; max-width: 900px; padding: 12px 16px; background: #fff; border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 14px 30px -18px rgba(0, 0, 0, .35); }
    .grow { flex: 1; }
    @media (max-width: 600px) {
      .finder { grid-template-columns: 1fr; }
      .count-row { grid-template-columns: 1fr 120px; }
      .gap { grid-column: 1 / -1; text-align: start; }
    }
  `,
})
export class Inventory implements OnInit {
  protected readonly data = inject(AdminData);
  protected readonly categories = signal<Category[]>([]);
  protected readonly search = signal('');
  protected readonly rayon = signal('');
  protected readonly counts = signal<Record<string, number | null>>({});
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly gapOf = gapOf;

  protected readonly lines = computed(() => countLines(this.data.products(), this.data.fridge()));
  protected readonly shown = computed(() => searchProducts(this.lines(), l => l.product, this.search(), this.rayon(), this.categories()));
  protected readonly summary = computed(() => countSummary(this.lines(), this.counts()));
  protected readonly changes = computed(() => this.lines().filter(l => { const g = gapOf(l, this.counts()[l.key]); return g !== null && g !== 0; }).length);

  async ngOnInit() {
    this.categories.set(await this.data.getCategories());
  }

  protected setCount(l: CountLine, value: number | string | null) {
    const n = value === null || value === '' ? null : Number(value);
    this.counts.update(c => ({ ...c, [l.key]: n }));
  }

  protected async apply() {
    const todo = this.lines().map(l => ({ l, gap: gapOf(l, this.counts()[l.key]) })).filter(x => x.gap !== null && x.gap !== 0);
    if (!confirm(`Corriger ${todo.length} ligne(s) ? Les manques partent en déstockage (correction d'inventaire).`)) return;
    this.busy.set(true);
    this.error.set('');
    let done = 0;
    try {
      for (const { l, gap } of todo) {
        await this.data.correctStock(l.product, gap!, l.origin, localDay(new Date()));
        this.counts.update(c => { const { [l.key]: _, ...rest } = c; return rest; });
        done++;
      }
      this.data.notify(`Inventaire enregistré : ${done} correction(s)`);
    } catch (e) {
      this.error.set(`${done} correction(s) faite(s), puis : ${(e as Error).message}`);
    } finally {
      this.busy.set(false);
    }
  }
}
