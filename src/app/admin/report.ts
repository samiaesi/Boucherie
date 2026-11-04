import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  FridgeItem, Order, Product, animals, isLowStock, isOutOfStock, itemQty, ownStock, reorderQty, roundStock, stockUnit,
} from '../core/data';
import { Shop } from '../core/shop';
import { AdminData } from './admin-data';

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => localDay(new Date());

export function reportSeenToday() {
  try {
    return localStorage.getItem('reportSeen') === today();
  } catch {
    return false;
  }
}

interface Row { product: Product; qty: number; }

@Component({
  selector: 'app-report',
  imports: [DatePipe],
  template: `
    <div class="head no-print">
      <h2>Rapport du {{ now | date: 'dd/MM/yyyy' }}</h2>
      <div class="chips">
        <button class="btn wa" (click)="sendWhatsApp()">Envoyer sur WhatsApp</button>
        <button class="btn light" (click)="print()">Imprimer</button>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><b>{{ outList().length }}</b><span>En rupture</span></div>
      <div class="stat"><b>{{ lowList().length }}</b><span>À remplir</span></div>
      <div class="stat"><b>{{ todayOrders().length }}</b><span>Commandes pour aujourd'hui</span></div>
      <div class="stat"><b>{{ tracked().length }}</b><span>Produits suivis</span></div>
    </div>

    @if (!tracked().length) {
      <div class="empty">Aucun produit suivi. Activez le suivi dans l'onglet Stock.</div>
    }

    <div class="report-grid">
      <section class="card-box">
        <h3>À racheter</h3>
        @for (p of outList(); track p.id) {
          <div class="row"><span>{{ p.name_fr }}</span><b class="red">Rupture{{ buy(p) }}</b></div>
        }
        @for (p of lowList(); track p.id) {
          <div class="row"><span>{{ p.name_fr }}</span><b class="orange">{{ label(p, p.stock ?? 0) }}{{ buy(p) }}</b></div>
        }
        @if (!outList().length && !lowList().length) { <p class="muted">Rien à signaler.</p> }
      </section>

      <section class="card-box">
        <h3>Frigo</h3>
        @for (f of fridgeList(); track f.id) {
          <div class="row"><span>{{ f.name }}</span><b [class.orange]="fridgeLow(f)">{{ fridgeLabel(f) }}</b></div>
        }
      </section>

      <section class="card-box">
        <h3>À préparer aujourd'hui</h3>
        @for (r of toPrepare(); track r.product.id) {
          <div class="row"><span>{{ r.product.name_fr }}</span><b>{{ label(r.product, r.qty) }}</b></div>
        } @empty { <p class="muted">Aucune commande pour aujourd'hui.</p> }
      </section>

      <section class="card-box">
        <h3>Vendu hier</h3>
        @for (r of soldYesterday(); track r.product.id) {
          <div class="row"><span>{{ r.product.name_fr }}</span><b>{{ label(r.product, r.qty) }}</b></div>
        } @empty { <p class="muted">Aucune vente enregistrée hier.</p> }
      </section>

      <section class="card-box">
        <h3>État du stock</h3>
        @for (p of tracked(); track p.id) {
          <div class="row"><span>{{ p.name_fr }}</span><b>{{ label(p, p.stock ?? 0) }}</b></div>
        } @empty { <p class="muted">Aucun produit suivi.</p> }
      </section>
    </div>
  `,
  styles: `
    .report-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .report-grid .card-box { max-width: none; align-content: start; gap: 6px; }
    .report-grid h3 { font-family: Inter, sans-serif; font-size: 1.05rem; margin-bottom: 6px; }
    .row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px dashed var(--line); }
    .red { color: var(--red); } .orange { color: var(--orange); } .muted { color: var(--muted); }
    @media print { .no-print { display: none; } }
  `,
})
export class Report implements OnInit {
  protected readonly data = inject(AdminData);
  private readonly shop = inject(Shop);
  private readonly products = signal<Product[]>([]);
  protected readonly now = new Date();

  /** Produits à stock propre : ceux reliés au frigo sont comptés dans sa réserve */
  private readonly own = computed(() => ownStock(this.products(), this.data.fridge()));
  protected readonly tracked = computed(() => this.own().filter(p => p.trackStock));
  protected readonly outList = computed(() => this.own().filter(isOutOfStock));
  protected readonly lowList = computed(() => this.own().filter(isLowStock));
  protected readonly fridgeList = computed(() => this.data.fridge().filter(f => f.tracked));
  protected readonly todayOrders = computed(() =>
    this.data.orders().filter(o => o.date === today() && !['annulé', 'récupéré', 'livré'].includes(o.status)));

  protected readonly toPrepare = computed(() => this.totals(this.todayOrders()));
  protected readonly soldYesterday = computed(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const day = localDay(y);
    return this.totals(this.data.orders().filter(o =>
      o.status !== 'annulé' && o.createdAt && localDay(o.createdAt) === day));
  });

  async ngOnInit() {
    try { localStorage.setItem('reportSeen', today()); } catch {}
    this.products.set(await this.data.list<Product>('products'));
    this.shop.load();
  }

  /** Additionne les articles de plusieurs commandes, produit par produit */
  private totals(orders: Order[]): Row[] {
    const sum = new Map<string, number>();
    for (const o of orders) {
      for (const i of o.items ?? []) sum.set(i.productId, (sum.get(i.productId) ?? 0) + itemQty(i));
    }
    return [...sum].flatMap(([id, qty]) => {
      const product = this.products().find(p => p.id === id);
      return product ? [{ product, qty }] : [];
    });
  }

  protected label(p: Product, qty: number) {
    return `${roundStock(qty)} ${stockUnit(p)}`;
  }

  protected buy(p: Product) {
    const qty = reorderQty(p);
    return qty ? ` · à racheter : ${qty} ${stockUnit(p)}` : '';
  }

  protected fridgeLow(f: FridgeItem) {
    return f.kg <= 0 || (!!f.min && f.kg <= f.min);
  }

  protected fridgeLabel(f: FridgeItem) {
    return `${roundStock(f.kg)} kg · env. ${animals(f)} ${f.name.toLowerCase()}`;
  }

  protected print() {
    window.print();
  }

  protected sendWhatsApp() {
    const list = (title: string, rows: string[]) => (rows.length ? [`*${title}*`, ...rows.map(r => `- ${r}`), ''] : []);
    const text = [
      `Rapport du ${this.now.toLocaleDateString('fr-FR')}`,
      '',
      ...list('Rupture', this.outList().map(p => `${p.name_fr}${this.buy(p)}`)),
      ...list('À remplir', this.lowList().map(p => `${p.name_fr} : ${this.label(p, p.stock ?? 0)}${this.buy(p)}`)),
      ...list('Frigo', this.fridgeList().map(f => `${f.name} : ${this.fridgeLabel(f)}`)),
      ...list("À préparer aujourd'hui", this.toPrepare().map(r => `${r.product.name_fr} : ${this.label(r.product, r.qty)}`)),
      ...list('Vendu hier', this.soldYesterday().map(r => `${r.product.name_fr} : ${this.label(r.product, r.qty)}`)),
      ...list('État du stock', this.tracked().map(p => `${p.name_fr} : ${this.label(p, p.stock ?? 0)}`)),
    ].join('\n');
    window.open(`https://wa.me/${this.shop.settings().whatsapp}?text=${encodeURIComponent(text)}`, '_blank');
  }
}
