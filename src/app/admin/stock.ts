import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Category, Product, ProductOrigin, byOrder, originLabel, originsOf, roundStock } from '../core/data';
import { productRef, searchProducts } from '../core/product-search';
import { AdminData } from './admin-data';
import { ChainSteps } from './chain-steps';
import { STATE_ICONS, STATE_LABELS, StockLine, StockState, stockCounts, stockLines } from './stock-lines';

type Filter = 'tous' | StockState;

interface Draft {
  id: string;
  trackStock: boolean;
  stock: number;
  stockAlert: number;
  stockMax: number;
  restockDate: string;
  origins: ProductOrigin[];
}

@Component({
  selector: 'app-stock',
  imports: [FormsModule, RouterLink, ChainSteps],
  template: `
    <div class="head">
      <h2>Stock</h2>
      <a class="btn small" routerLink="/admin/arrivages">Nouvel arrivage</a>
    </div>

    <app-chain-steps current="stock" />
    <div class="summary">
      @for (c of cards(); track c.id) {
        <button class="tile" [class]="'tile ' + c.id" [class.active]="filter() === c.id" (click)="filter.set(c.id)">
          <b>{{ c.count }}</b><span>{{ c.label }}</span>
        </button>
      }
    </div>

    <div class="finder">
      <input type="search" placeholder="Référence, nom, rayon ou pays…" aria-label="Rechercher un produit" [ngModel]="search()" (ngModelChange)="search.set($event)" name="search">
      <select aria-label="Rayon" [ngModel]="rayon()" (ngModelChange)="rayon.set($event)" name="rayon">
        <option value="">Tous les rayons</option>
        @for (c of categories(); track c.id) { <option [value]="c.id">{{ c.name_fr }}</option> }
      </select>
      <span>{{ shown().length }} / {{ lines().length }}</span>
    </div>

    @if (data.ready() && !lines().length) {
      <div class="empty">Aucun produit dans Firebase. Importez d'abord les produits dans <a routerLink="/admin/produits">l'onglet Produits</a>.</div>
    }

    <div class="table">
      <div class="row titles" aria-hidden="true"><span>Produit</span><span>État</span><span>Quantité</span><span>Alerte</span><span></span></div>
      @for (l of shown(); track l.product.id) {
        <div class="row" [class.off]="l.state === 'untracked'">
          <div class="name">
            <b>{{ l.product.name_fr }}</b>
            <small>Réf. {{ ref(l.product) }} · {{ rayonName(l.product) }}{{ origin(l.product) ? ' · ' + origin(l.product) : '' }}</small>
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
            @if (d.origins.length) {
              @for (o of d.origins; track o.country; let i = $index) {
                <label>{{ o.country }} ({{ l.unit }})<input [name]="'origin' + i" type="number" min="0" step="0.5" [(ngModel)]="o.stock"></label>
              }
            } @else {
              <label>Stock actuel ({{ l.unit }})<input name="stock" type="number" min="0" step="0.5" [(ngModel)]="d.stock"></label>
            }
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
    .finder { display: grid; grid-template-columns: minmax(0, 1fr) 220px auto; gap: 10px; align-items: center; max-width: 760px; margin-bottom: 12px; }
    .finder span { color: var(--muted); font-size: .86rem; white-space: nowrap; }
    .table { background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
    .row { display: grid; grid-template-columns: minmax(170px, 1.5fr) 150px minmax(150px, 1.2fr) 90px 150px; gap: 14px; align-items: center; padding: 11px 16px; border-top: 1px solid var(--line); }
    .row:first-child { border-top: 0; }
    .row.off .name b { color: var(--muted); font-weight: 600; }
    .titles { padding-block: 9px; background: var(--bg); color: var(--muted); font-size: .78rem; font-weight: 600; }
    .name small, .qty small, .limits small { display: block; color: var(--muted); font-size: .78rem; }
    .none { color: var(--muted); }
    .action { text-align: end; }
    .editor { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; align-items: end; padding: 14px 16px; background: var(--bg); border-top: 1px dashed var(--line); }
    .buttons { display: flex; gap: 8px; }
    @media (max-width: 800px) {
      .titles { display: none; }
      .finder { grid-template-columns: 1fr auto; }
      .finder input { grid-column: 1 / -1; }
      .row { grid-template-columns: 1fr auto; gap: 8px 12px; }
      .limits { display: flex; gap: 12px; }
      .action { text-align: end; }
    }
  `,
})
export class Stock implements OnInit {
  protected readonly data = inject(AdminData);
  protected readonly categories = signal<Category[]>([]);
  protected readonly rayon = signal('');
  protected readonly ref = productRef;
  protected readonly origin = originLabel;
  protected readonly filter = signal<Filter>('tous');
  protected readonly search = signal('');
  protected readonly draft = signal<Draft | null>(null);
  protected readonly busy = signal(false);
  protected readonly label = (s: StockState) => STATE_LABELS[s];
  protected readonly icon = (s: StockState) => STATE_ICONS[s];

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
    const f = this.filter();
    const lines = this.lines().filter((l: StockLine) => f === 'tous' || l.state === f);
    return searchProducts(lines, l => l.product, this.search(), this.rayon(), this.categories());
  });

  async ngOnInit() {
    this.categories.set(await this.data.getCategories());
  }

  protected rayonName(p: Product) {
    return this.categories().find(c => c.id === p.category)?.name_fr ?? p.category;
  }

  protected open(p: Product, trackStock: boolean) {
    this.draft.set({
      id: p.id, trackStock, stock: p.stock ?? 0, stockAlert: p.stockAlert ?? 0, stockMax: p.stockMax ?? 0, restockDate: p.restockDate ?? '',
      origins: originsOf(p).map(o => ({ ...o })),
    });
  }

  protected async save() {
    const d = this.draft();
    if (!d) return;
    const num = (n: number) => Math.max(0, Number(n) || 0);
    this.busy.set(true);
    try {
      const origins = d.origins.map((o): ProductOrigin => {
        const { stock, ...rest } = o;
        return stock === undefined || stock === null ? rest : { ...rest, stock: num(stock) };
      });
      const counted = origins.some(o => o.stock !== undefined);
      await this.data.update('products', d.id, {
        ...(counted ? { origins } : {}),
        trackStock: d.trackStock, stock: counted ? roundStock(origins.reduce((sum, o) => sum + (o.stock ?? 0), 0)) : num(d.stock), stockAlert: num(d.stockAlert), stockMax: num(d.stockMax), restockDate: d.restockDate,
      });
      this.data.notify('Stock enregistré');
      this.draft.set(null);
    } finally {
      this.busy.set(false);
    }
  }
}
