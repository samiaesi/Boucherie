import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatNumber } from '../core/data';
import { algeriaClock } from '../core/ordering';
import { planningDays } from '../core/planning';
import { AdminData } from './admin-data';

const PERIODS = [
  { days: 1, label: "Aujourd'hui" }, { days: 2, label: 'Avec demain' }, { days: 7, label: '7 jours' }, { days: 30, label: '30 jours' },
];

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-planning',
  imports: [RouterLink],
  template: `
    <div class="head no-print">
      <h2>Planning de préparation</h2>
      <div class="chips">
        @for (p of periods; track p.days) {
          <button class="btn small" [class.light]="days() !== p.days" (click)="days.set(p.days)">{{ p.label }}</button>
        }
        <button class="btn light small" (click)="print()">Imprimer</button>
      </div>
    </div>
    <h2 class="print-only">Planning de préparation</h2>
    @for (d of plan(); track d.date) {
      <section class="day card-box">
        <h3>{{ dayName(d.date) }}</h3>
        <div class="totals">
          @for (t of d.totals; track t.name + t.option) {
            <div><b>{{ t.grams ? kilos(t.grams) : t.qty + ' ×' }}</b> {{ t.name }}@if (t.option) { <small>{{ t.option }}</small> }</div>
          }
        </div>
        <table>
          <thead><tr><th>Heure</th><th>Client</th><th>Téléphone</th><th>À préparer</th><th>Statut</th></tr></thead>
          <tbody>
            @for (e of d.entries; track e.order.id) {
              <tr>
                <td><b>{{ e.time || 'Dans la journée' }}</b></td>
                <td>{{ e.order.name }}</td>
                <td dir="ltr">{{ e.order.tel }}</td>
                <td>
                  @for (i of e.items; track $index) {
                    <div>{{ i.qty }} × {{ i.name_fr }}{{ i.grams ? ' · ' + kilos(i.grams) : '' }}{{ i.option_fr ? ' · ' + i.option_fr : '' }}</div>
                  }
                </td>
                <td>{{ e.order.status }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    } @empty {
      <div class="empty">Rien à préparer sur cette période. <a routerLink="/admin/commandes">Voir les commandes</a></div>
    }
  `,
  styles: `
    .day { display: grid; gap: 12px; margin-bottom: 16px; }
    .day h3 { margin: 0; text-transform: capitalize; }
    .totals { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 8px; }
    .totals > div { padding: 10px 12px; border-radius: 12px; background: var(--soft, #f7f1ea); }
    .totals small { display: block; color: var(--muted); }
    table { width: 100%; border-collapse: collapse; font-size: .9rem; }
    th, td { padding: 9px 8px; border-bottom: 1px solid var(--border); text-align: start; vertical-align: top; }
    th { color: var(--muted); font-size: .8rem; }
    .print-only { display: none; }
    @media print { .no-print { display: none; } .print-only { display: block; } }
  `,
})
export class Planning {
  private readonly data = inject(AdminData);
  protected readonly periods = PERIODS;
  protected readonly days = signal(2);
  protected readonly plan = computed(() => {
    const today = algeriaClock(new Date()).date;
    return planningDays(this.data.orders(), today, addDays(today, this.days() - 1));
  });

  protected kilos(grams: number) {
    return grams >= 1000 ? `${formatNumber(grams / 1000)} kg` : `${grams} g`;
  }

  protected dayName(date: string) {
    return new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  protected print() {
    window.print();
  }
}
