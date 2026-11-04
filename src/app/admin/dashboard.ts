import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { animals, formatNumber, isOutOfStock, ownStock, roundStock } from '../core/data';
import { Ranked, localDay, orderStats } from '../core/stats';
import { AdminData } from './admin-data';

type Period = 'today' | '7' | '30' | 'month';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  template: `
    <div class="head">
      <h2>Tableau de bord</h2>
      <div class="chips">
        @for (p of periods; track p[0]) {
          <button class="chip" [class.active]="p[0] === period()" (click)="period.set(p[0])">{{ p[1] }}</button>
        }
      </div>
    </div>

    <div class="stats">
      <div class="stat"><b>{{ s().received }}</b><span>Commandes reçues</span></div>
      <div class="stat"><b>{{ s().inProgress }}</b><span>En cours</span></div>
      <div class="stat"><b>{{ s().delivered }}</b><span>Livrées</span></div>
      <div class="stat"><b>{{ s().pickedUp }}</b><span>Récupérées</span></div>
      <div class="stat"><b>{{ s().cancelled }}</b><span>Annulées</span></div>
    </div>
    <div class="stats">
      <div class="stat"><b>{{ num(s().revenue) }} DA</b><span>Chiffre d'affaires</span></div>
      <div class="stat"><b>{{ num(s().average) }} DA</b><span>Panier moyen</span></div>
      <div class="stat"><b>{{ s().deliveryOrders }} / {{ s().pickupOrders }}</b><span>Livraison / retrait</span></div>
    </div>
    @if (s().withoutAmount) {
      <p class="hint">{{ s().withoutAmount }} commande(s) anciennes sans montant ne sont pas comptées dans le chiffre d'affaires.</p>
    }

    <section class="card-box panel">
      <h3>Commandes reçues par jour</h3>
      @if (s().received) {
        <div class="days" role="img" [attr.aria-label]="s().received + ' commandes sur la période'">
          @for (d of s().perDay; track d.day) {
            <div class="day" tabindex="0" [attr.data-tip]="tip(d.day, d.count)">
              <span class="bar" [style.height.%]="height(d.count)"></span>
            </div>
          }
        </div>
        <div class="axis"><span>{{ short(s().perDay[0].day) }}</span><span>{{ short(s().perDay[s().perDay.length - 1].day) }}</span></div>
      } @else {
        <p class="muted">Aucune commande sur cette période.</p>
      }
    </section>

    <div class="panels">
      <section class="card-box panel">
        <h3>Produits les plus vendus</h3>
        @for (p of s().topProducts; track p.label) {
          <div class="rank"><span>{{ p.label }}</span><b>{{ round(p.value) }} {{ p.unit }}</b>
            <i><u [style.width.%]="share(p, s().topProducts)"></u></i></div>
        } @empty { <p class="muted">Pas encore de vente détaillée.</p> }
      </section>

      <section class="card-box panel">
        <h3>Lieux de livraison</h3>
        @for (z of s().zones; track z.label) {
          <div class="rank"><span>{{ z.label }}</span><b>{{ z.value }}</b>
            <i><u [style.width.%]="share(z, s().zones)"></u></i></div>
        } @empty { <p class="muted">Aucune livraison sur cette période.</p> }
      </section>

      <section class="card-box panel">
        <h3>Stock</h3>
        @for (f of reserves(); track f.id) {
          <div class="row"><span>{{ f.name }}</span>
            <b [class.alert]="f.kg <= 0" [class.warn]="f.kg > 0 && !!f.min && f.kg <= f.min">
              {{ f.kg <= 0 ? 'Rupture' : round(f.kg) + ' kg · env. ' + beasts(f) }}
            </b></div>
        }
        <div class="row"><span>Produits en rupture</span><b [class.alert]="soldOut()">{{ soldOut() }}</b></div>
        <a class="link" routerLink="/admin/stock">Voir le stock</a>
      </section>
    </div>
  `,
  styles: `
    .hint, .muted { color: var(--muted); font-size: .88rem; }
    .hint { margin-bottom: 16px; }
    .panel { max-width: none; gap: 8px; margin-bottom: 16px; align-content: start; }
    .panel h3 { font-family: Inter, sans-serif; font-size: 1.02rem; margin-bottom: 4px; }
    .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 16px; }
    .days { display: flex; align-items: flex-end; gap: 2px; height: 170px; border-bottom: 1px solid var(--line); }
    .day { position: relative; flex: 1; display: flex; align-items: flex-end; height: 100%; }
    .bar { display: block; width: 100%; max-width: 36px; margin: 0 auto; min-height: 2px; border-radius: 4px 4px 0 0; background: var(--bordeaux); opacity: .9; }
    .day:hover .bar, .day:focus .bar { opacity: 1; background: var(--bordeaux-dark); }
    .day:hover::after, .day:focus::after { content: attr(data-tip); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); z-index: 2; padding: 4px 8px; border-radius: 6px; background: var(--ink); color: #fff; font-size: .78rem; white-space: nowrap; }
    .axis { display: flex; justify-content: space-between; color: var(--muted); font-size: .78rem; }
    .rank { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; }
    .rank i { grid-column: 1 / -1; display: block; height: 6px; border-radius: 4px; background: #f3eee6; overflow: hidden; }
    .rank u { display: block; height: 100%; border-radius: 4px; background: var(--bordeaux); }
    .row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; border-bottom: 1px dashed var(--line); }
    .alert { color: var(--red); } .warn { color: var(--orange); }
    .link { color: var(--bordeaux); font-size: .88rem; text-decoration: underline; }
  `,
})
export class Dashboard {
  private readonly data = inject(AdminData);
  protected readonly period = signal<Period>('7');
  protected readonly periods: [Period, string][] = [['today', "Aujourd'hui"], ['7', '7 jours'], ['30', '30 jours'], ['month', 'Ce mois']];
  protected readonly num = formatNumber;
  protected readonly round = roundStock;

  private readonly range = computed(() => {
    const now = new Date(), start = new Date(now), p = this.period();
    if (p === 'month') start.setDate(1);
    else if (p !== 'today') start.setDate(start.getDate() - (Number(p) - 1));
    return [localDay(start), localDay(now)] as const;
  });

  protected readonly s = computed(() => orderStats(this.data.orders(), ...this.range(), this.data.products()));
  private readonly peak = computed(() => Math.max(1, ...this.s().perDay.map(d => d.count)));
  protected readonly reserves = computed(() => this.data.fridge().filter(f => f.tracked));
  protected readonly soldOut = computed(() => ownStock(this.data.products(), this.data.fridge()).filter(isOutOfStock).length);

  protected height(count: number) {
    return (count / this.peak()) * 100;
  }

  protected share(item: Ranked, list: Ranked[]) {
    return (item.value / Math.max(...list.map(x => x.value))) * 100;
  }

  protected short(day: string) {
    return `${day.slice(8)}/${day.slice(5, 7)}`;
  }

  protected tip(day: string, count: number) {
    return `${this.short(day)} : ${count} commande${count > 1 ? 's' : ''}`;
  }

  protected beasts(f: Parameters<typeof animals>[0]) {
    return `${animals(f)} ${f.name.toLowerCase()}`;
  }
}
