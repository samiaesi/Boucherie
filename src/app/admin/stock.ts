import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Product, byOrder } from '../core/data';
import { AdminData } from './admin-data';
import { STATE_LABELS, StockLine, StockState, stockCounts, stockLines } from './stock-lines';

type Filter = 'tous' | StockState;

const ICONS: Record<StockState, string> = {
  out: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM6 6l12 12',
  low: 'M12 4L3 20h18zM12 10v5M12 18v.01',
  over: 'M12 20V5M6 11l6-6 6 6',
  ok: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6',
  untracked: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12h8',
};

interface Draft {
  id: string;
  trackStock: boolean;
  stock: number;
  stockAlert: number;
  stockMax: number;
  restockDate: string;
}

@Component({
  selector: 'app-stock',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="head">
      <h2>Stock</h2>
      <a class="btn small" routerLink="/admin/arrivages">Nouvel arrivage</a>
    </div>

    <div class="summary">
      @for (c of cards(); track c.id) {
        <button class="tile" [class]="'tile ' + c.id" [class.active]="filter() === c.id" (click)="filter.set(c.id)">
          <b>{{ c.count }}</b><span>{{ c.label }}</span>
        </button>
      }
    </div>

    <input class="search" type="search" placeholder="Rechercher un produit…" aria-label="Rechercher un produit" [ngModel]="search()" (ngModelChange)="search.set($event)" name="search">

    @if (data.ready() && !lines().length) {
      <div class="empty">Aucun produit dans Firebase. Importez d'abord les produits dans <a routerLink="/admin/produits">l'onglet Produits</a>.</div>
    }

    <div class="table">
      <div class="row titles" aria-hidden="true"><span>Produit</span><span>État</span><span>Quantité</span><span>Alerte</span><span></span></div>
      @for (l of shown(); track l.product.id) {
        <div class="row" [class.off]="l.state === 'untracked'">
          <div class="name">
            <b>{{ l.product.name_fr }}</b>
            @if (l.pool) { <small>Réserve : {{ l.pool.name }}</small> }
          </div>
          <div>
            <span class="state" [class]="'state ' + l.state">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="icon(l.state)" /></svg>{{ label(l.state) }}
            </span>
          </div>
          <div class="qty">
            @if (l.state === 'untracked') { <span class="none">—</span> }
            @else {
              <b>{{ l.qty }} {{ l.unit }}</b>
              @if (l.fill !== null) { <span class="gauge"><i [class]="l.state" [style.width.%]="l.fill"></i></span> }
              @if (l.reorder) { <small>À commander : {{ l.reorder }} {{ l.unit }}</small> }
            }
          </div>
          <div class="limits">
            @if (l.state === 'untracked') { <span class="none">—</span> }
            @else { <small>Min {{ l.min || '—' }}</small><small>Max {{ l.max || '—' }}</small> }
          </div>
          <div class="action">
            @if (l.pool) { <a class="btn light small" routerLink="/admin/frigo">Gérer le frigo</a> }
            @else if (l.state === 'untracked') { <button class="btn light small" (click)="open(l.product, true)">Suivre ce stock</button> }
            @else { <button class="btn light small" (click)="open(l.product, true)">Modifier</button> }
          </div>
        </div>
        @if (draft()?.id === l.product.id && draft(); as d) {
          <form class="editor" (ngSubmit)="save()">
            <label>Stock actuel ({{ l.unit }})<input name="stock" type="number" min="0" step="0.5" [(ngModel)]="d.stock"></label>
            <label>Minimum<input name="min" type="number" min="0" step="0.5" [(ngModel)]="d.stockAlert"></label>
            <label>Maximum<input name="max" type="number" min="0" step="0.5" [(ngModel)]="d.stockMax"></label>
            @if (l.state === 'out') { <label>Retour prévu<input name="back" type="date" [(ngModel)]="d.restockDate"></label> }
            <label class="check"><input name="track" type="checkbox" [(ngModel)]="d.trackStock"> Suivre ce produit</label>
            <div class="buttons">
              <button class="btn small" type="submit" [disabled]="busy()">Enregistrer</button>
              <button class="btn light small" type="button" (click)="draft.set(null)">Fermer</button>
            </div>
          </form>
        }
      } @empty {
        @if (lines().length) { <div class="empty">Aucun produit dans cette liste.</div> }
      }
    </div>
  `,
  styles: `
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 14px; }
    .tile { display: grid; gap: 2px; padding: 12px 14px; text-align: start; background: #fff; border: 1px solid var(--line); border-radius: 12px; cursor: pointer; font: inherit; }
    .tile b { font-size: 1.5rem; line-height: 1.1; }
    .tile span { color: var(--muted); font-size: .84rem; }
    .tile.out b { color: var(--red); }
    .tile.low b { color: var(--orange); }
    .tile.ok b { color: var(--green); }
    .tile.active { border-color: var(--ink, #1d1613); box-shadow: inset 0 0 0 1px var(--ink, #1d1613); }
    .search { max-width: 340px; margin-bottom: 12px; }
    .table { background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
    .row { display: grid; grid-template-columns: minmax(170px, 1.5fr) 150px minmax(150px, 1.2fr) 90px 150px; gap: 14px; align-items: center; padding: 11px 16px; border-top: 1px solid var(--line); }
    .row:first-child { border-top: 0; }
    .row.off .name b { color: var(--muted); font-weight: 600; }
    .titles { padding-block: 9px; background: var(--bg); color: var(--muted); font-size: .78rem; font-weight: 600; }
    .name small, .qty small, .limits small { display: block; color: var(--muted); font-size: .78rem; }
    .state { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: .8rem; font-weight: 600; white-space: nowrap; }
    .state svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .state.ok { background: #e7f4ec; color: var(--green); }
    .state.low { background: #fdf1dc; color: #94570f; }
    .state.out { background: #fbeaea; color: var(--red); }
    .state.over { background: #e7eef8; color: var(--blue); }
    .state.untracked { background: #f1eee9; color: var(--muted); }
    .gauge { display: block; height: 6px; margin: 5px 0 3px; border-radius: 3px; background: #efeae3; overflow: hidden; }
    .gauge i { display: block; height: 100%; border-radius: 3px; background: var(--green); }
    .gauge i.low { background: var(--orange); }
    .gauge i.out { background: var(--red); }
    .gauge i.over { background: var(--blue); }
    .none { color: var(--muted); }
    .action { text-align: end; }
    .editor { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; align-items: end; padding: 14px 16px; background: var(--bg); border-top: 1px dashed var(--line); }
    .buttons { display: flex; gap: 8px; }
    @media (max-width: 800px) {
      .titles { display: none; }
      .row { grid-template-columns: 1fr auto; gap: 8px 12px; }
      .limits { display: flex; gap: 12px; }
      .action { text-align: end; }
    }
  `,
})
export class Stock {
  protected readonly data = inject(AdminData);
  protected readonly filter = signal<Filter>('tous');
  protected readonly search = signal('');
  protected readonly draft = signal<Draft | null>(null);
  protected readonly busy = signal(false);
  protected readonly label = (s: StockState) => STATE_LABELS[s];
  protected readonly icon = (s: StockState) => ICONS[s];

  protected readonly lines = computed(() => stockLines([...this.data.products()].sort(byOrder), this.data.fridge()));

  protected readonly cards = computed(() => {
    const counts = stockCounts(this.lines());
    return [
      { id: 'tous' as Filter, label: 'Tous les produits', count: this.lines().length },
      { id: 'ok' as Filter, label: 'En stock', count: counts.ok },
      { id: 'low' as Filter, label: 'Stock bas', count: counts.low },
      { id: 'out' as Filter, label: 'Rupture', count: counts.out },
      { id: 'over' as Filter, label: 'Trop de stock', count: counts.over },
      { id: 'untracked' as Filter, label: 'Non suivis', count: counts.untracked },
    ];
  });

  protected readonly shown = computed(() => {
    const f = this.filter(), q = this.search().trim().toLowerCase();
    return this.lines().filter((l: StockLine) =>
      (f === 'tous' || l.state === f) && (!q || l.product.name_fr.toLowerCase().includes(q)));
  });

  protected open(p: Product, trackStock: boolean) {
    this.draft.set({
      id: p.id, trackStock, stock: p.stock ?? 0, stockAlert: p.stockAlert ?? 0, stockMax: p.stockMax ?? 0, restockDate: p.restockDate ?? '',
    });
  }

  protected async save() {
    const d = this.draft();
    if (!d) return;
    const num = (n: number) => Math.max(0, Number(n) || 0);
    this.busy.set(true);
    try {
      await this.data.update('products', d.id, {
        trackStock: d.trackStock, stock: num(d.stock), stockAlert: num(d.stockAlert), stockMax: num(d.stockMax), restockDate: d.restockDate,
      });
      this.data.notify('Stock enregistré');
      this.draft.set(null);
    } finally {
      this.busy.set(false);
    }
  }
}
