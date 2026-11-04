import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatNumber } from '../core/data';
import { Invoice } from '../core/invoice';
import { declarationCsv, declarationRows, declarationTotals } from '../core/pro-invoice';
import { AdminData } from './admin-data';

const pad = (n: number) => String(n).padStart(2, '0');

@Component({
  selector: 'app-declaration',
  imports: [FormsModule],
  template: `
    <div class="head">
      <h2>Déclaration des factures</h2>
      <div class="chips no-print">
        <button class="btn light" [disabled]="!rows().length" (click)="exportCsv()">Exporter pour Excel</button>
        <button class="btn light" (click)="print()">Imprimer</button>
      </div>
    </div>
    <div class="period no-print">
      <label>Du<input type="date" [ngModel]="from()" (ngModelChange)="from.set($event)"></label>
      <label>Au<input type="date" [ngModel]="to()" (ngModelChange)="to.set($event)"></label>
      <div class="chips">
        <button class="chip" (click)="month(0)">Ce mois</button>
        <button class="chip" (click)="month(-1)">Mois dernier</button>
        <button class="chip" (click)="quarter()">Ce trimestre</button>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><b>{{ rows().length }}</b><span>Factures</span></div>
      <div class="stat"><b>{{ num(totals().ht) }} DA</b><span>Total HT</span></div>
      <div class="stat"><b>{{ num(totals().tva) }} DA</b><span>TVA collectée</span></div>
      <div class="stat"><b>{{ num(totals().stamp) }} DA</b><span>Timbre</span></div>
      <div class="stat"><b>{{ num(totals().ttc) }} DA</b><span>Total TTC</span></div>
    </div>

    <div class="card-box table-box">
      <table>
        <thead><tr><th>Date</th><th>Numéro</th><th>Client</th><th>NIF</th><th>HT</th><th>TVA</th><th>Timbre</th><th>TTC</th></tr></thead>
        <tbody>
          @for (r of rows(); track r.number) {
            <tr><td>{{ r.date }}</td><td>{{ r.number }}</td><td>{{ r.client }}</td><td>{{ r.nif }}</td>
              <td>{{ num(r.ht) }}</td><td>{{ num(r.tva) }}</td><td>{{ num(r.stamp) }}</td><td>{{ num(r.ttc) }}</td></tr>
          } @empty {
            <tr><td colspan="8" class="none">{{ loaded() ? 'Aucune facture sur cette période.' : 'Chargement…' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .period { display: flex; gap: 12px; align-items: end; flex-wrap: wrap; margin-bottom: 16px; }
    .period label { width: 170px; }
    .table-box { max-width: none; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: .9rem; }
    th { padding: 8px; text-align: start; border-bottom: 2px solid var(--ink); white-space: nowrap; }
    td { padding: 8px; border-bottom: 1px solid var(--line); }
    th:nth-child(n + 5), td:nth-child(n + 5) { text-align: end; white-space: nowrap; }
    .none { text-align: center; color: var(--muted); padding: 24px; }
    @media print { .no-print { display: none; } }
  `,
})
export class Declaration implements OnInit {
  private readonly data = inject(AdminData);
  private readonly invoices = signal<Invoice[]>([]);
  protected readonly loaded = signal(false);
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly num = formatNumber;
  protected readonly rows = computed(() => declarationRows(this.invoices(), this.from(), this.to()));
  protected readonly totals = computed(() => declarationTotals(this.rows()));

  async ngOnInit() {
    this.month(0);
    this.invoices.set(await this.data.listInvoices());
    this.loaded.set(true);
  }

  private range(start: Date, end: Date) {
    const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    this.from.set(iso(start));
    this.to.set(iso(end));
  }

  protected month(offset: number) {
    const now = new Date();
    this.range(new Date(now.getFullYear(), now.getMonth() + offset, 1), new Date(now.getFullYear(), now.getMonth() + offset + 1, 0));
  }

  protected quarter() {
    const now = new Date(), q = Math.floor(now.getMonth() / 3) * 3;
    this.range(new Date(now.getFullYear(), q, 1), new Date(now.getFullYear(), q + 3, 0));
  }

  protected print() {
    window.print();
  }

  protected exportCsv() {
    const url = URL.createObjectURL(new Blob([declarationCsv(this.rows())], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `declaration-${this.from()}-${this.to()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
