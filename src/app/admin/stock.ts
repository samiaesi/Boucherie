import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Product, byOrder, isLowStock, isOutOfStock, isOverStock, poolOf, roundStock, stockUnit } from '../core/data';
import { AdminData } from './admin-data';

type Filter = 'tous' | 'suivis' | 'bas' | 'rupture';

@Component({
  selector: 'app-stock',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="head">
      <h2>Stock</h2>
      <a class="btn small" routerLink="/admin/arrivages">Nouvel arrivage</a>
      <div class="chips">
        @for (f of filters; track f[0]) {
          <button class="chip" [class.active]="f[0] === filter()" (click)="filter.set(f[0])">{{ f[1] }}</button>
        }
      </div>
    </div>

    @if (loaded() && !products().length) {
      <div class="empty">Aucun produit dans Firebase. Importez d'abord les produits dans <a routerLink="/admin/produits">l'onglet Produits</a>.</div>
    }

    <div class="items">
      @for (p of shown(); track p.id) {
        <div class="item stock-row" [class.off]="!p.trackStock && !pool(p)">
          <div class="info">
            <b>{{ p.name_fr }}
              @if (pool(p)) {}
              @else if (out(p)) { <span class="pill alert">Rupture</span> }
              @else if (low(p)) { <span class="pill warn">À remplir</span> }
              @else if (over(p)) { <span class="pill">Trop de stock</span> }
            </b>
            <small>{{ pool(p) ? 'Coupe vendue depuis la réserve' : p.trackStock ? round(p.stock ?? 0) + ' ' + unit(p) + ' en stock' : 'Stock non suivi' }}</small>
          </div>
          @if (pool(p); as f) {
            <a class="btn light small" routerLink="/admin/frigo">Stock géré par le frigo : {{ f.name }} ({{ round(f.kg) }} kg)</a>
          } @else {
          <label class="check"><input type="checkbox" [checked]="p.trackStock" (change)="save(p, { trackStock: $any($event.target).checked })"> Suivre</label>
          @if (p.trackStock) {
            <label>Stock ({{ unit(p) }})
              <input type="number" min="0" step="0.5" [value]="round(p.stock ?? 0)" (change)="save(p, { stock: num($event) })">
            </label>
            <label>Minimum
              <input type="number" min="0" step="0.5" [value]="p.stockAlert ?? 0" (change)="save(p, { stockAlert: num($event) })">
            </label>
            <label>Maximum
              <input type="number" min="0" step="0.5" [value]="p.stockMax ?? 0" (change)="save(p, { stockMax: num($event) })">
            </label>
            @if (out(p)) {
              <label>Retour prévu
                <input type="date" [value]="p.restockDate ?? ''" (change)="save(p, { restockDate: $any($event.target).value })">
              </label>
            }
          }
          }
        </div>
      }
    </div>
  `,
  styles: `
    .stock-row { flex-wrap: wrap; }
    .stock-row label:not(.check) { width: 120px; }
    .stock-row label:last-child { width: 190px; }
  `,
})
export class Stock implements OnInit {
  private readonly data = inject(AdminData);
  protected readonly products = signal<Product[]>([]);
  protected readonly loaded = signal(false);
  protected readonly filter = signal<Filter>('tous');
  protected readonly filters: [Filter, string][] = [['tous', 'Tous'], ['suivis', 'Suivis'], ['bas', 'Stock bas'], ['rupture', 'Rupture']];
  protected readonly out = isOutOfStock;
  protected readonly low = isLowStock;
  protected readonly over = isOverStock;
  protected readonly round = roundStock;
  protected readonly unit = stockUnit;

  protected readonly shown = computed(() => {
    const f = this.filter();
    return this.products().filter(p =>
      f === 'tous' ? true : f === 'suivis' ? p.trackStock : f === 'bas' ? isLowStock(p) : isOutOfStock(p));
  });

  async ngOnInit() {
    await this.reload();
  }

  private async reload() {
    this.products.set((await this.data.list<Product>('products')).sort(byOrder));
    this.loaded.set(true);
  }

  protected pool(p: Product) {
    return poolOf(p, this.data.fridge());
  }

  protected num(e: Event) {
    return Math.max(0, Number((e.target as HTMLInputElement).value) || 0);
  }

  protected async save(p: Product, patch: Partial<Product>) {
    await this.data.update('products', p.id, patch);
    this.data.notify('Stock enregistré');
    await this.reload();
  }

}
