import { Component, computed, inject, signal } from '@angular/core';
import { formatNumber } from '../core/data';
import { salesReport } from '../core/sales';
import { AdminData } from './admin-data';

const PERIODS = [{ days: 7, label: '7 jours' }, { days: 30, label: '30 jours' }, { days: 90, label: '90 jours' }, { days: 365, label: '1 an' }];
const DAY = 86400000;

@Component({
  selector: 'app-sales',
  template: `
    <div class="head">
      <h2>Ventes par produit</h2>
      <div class="chips">
        @for (p of periods; track p.days) {
          <button class="btn small" [class.light]="days() !== p.days" (click)="days.set(p.days)">{{ p.label }}</button>
        }
      </div>
    </div>
    <div class="tiles">
      <div class="card-box"><small>Chiffre d'affaires</small><b>{{ num(report().revenue) }} DA</b></div>
      <div class="card-box"><small>Commandes</small><b>{{ report().orders }}</b></div>
      <div class="card-box"><small>Panier moyen</small><b>{{ num(report().average) }} DA</b></div>
    </div>
    @if (report().rows.length) {
      <div class="card-box">
        <table>
          <thead><tr><th>Produit</th><th>Vendu</th><th>Montant</th><th>Part du total</th></tr></thead>
          <tbody>
            @for (r of report().rows; track r.id) {
              <tr>
                <td><b>{{ r.name }}</b></td>
                <td>{{ sold(r.qty, r.grams) }}</td>
                <td>{{ num(r.revenue) }} DA</td>
                <td class="share"><span><i [style.width.%]="r.share"></i></span>{{ r.share }} %</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="empty">Aucune vente sur cette période.</div>
    }
    @if (report().unsold.length) {
      <h3>Pas vendus sur cette période ({{ report().unsold.length }})</h3>
      <p class="unsold">{{ unsoldNames() }}</p>
    }
  `,
  styles: `
    .tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
    .tiles small { display: block; color: var(--muted); }
    .tiles b { font-size: 1.5rem; }
    table { width: 100%; border-collapse: collapse; font-size: .92rem; }
    th, td { padding: 9px 8px; border-bottom: 1px solid var(--border); text-align: start; }
    th { color: var(--muted); font-size: .8rem; }
    .share { display: flex; align-items: center; gap: 8px; }
    .share span { flex: 1; min-width: 60px; height: 8px; overflow: hidden; border-radius: 4px; background: var(--border); }
    .share i { display: block; height: 100%; border-radius: 4px; background: #7a1f2b; }
    .unsold { color: var(--muted); }
    @media (max-width: 600px) { .tiles { grid-template-columns: 1fr; } }
  `,
})
export class Sales {
  private readonly data = inject(AdminData);
  protected readonly periods = PERIODS;
  protected readonly days = signal(30);
  protected readonly num = formatNumber;
  protected readonly report = computed(() => {
    const to = new Date();
    return salesReport(this.data.orders(), this.data.products(), new Date(to.getTime() - this.days() * DAY), to);
  });
  protected readonly unsoldNames = computed(() => this.report().unsold.map(p => p.name_fr).join(', '));

  protected sold(qty: number, grams: number) {
    const parts = [grams ? `${formatNumber(Math.round(grams / 100) / 10)} kg` : '', qty ? `${qty} pièce(s)` : ''];
    return parts.filter(Boolean).join(' + ');
  }
}
