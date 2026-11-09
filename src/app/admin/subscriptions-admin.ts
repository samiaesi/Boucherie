import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product, formatNumber } from '../core/data';
import { DAY_NAMES } from '../core/i18n';
import { localDay } from '../core/stats';
import { Subscription, duePanels, nextDate, refreshItems } from '../core/subscriptions';
import { AdminData } from './admin-data';

@Component({
  selector: 'app-subscriptions-admin',
  imports: [RouterLink],
  template: `
    <div class="head"><h2>Paniers de la semaine</h2></div>
    <p class="hint">Les clients qui reçoivent la même commande chaque semaine. Les paniers des deux prochains jours apparaissent en haut : créez la commande, elle arrive dans <a routerLink="/admin/commandes">Commandes</a> aux prix du jour.</p>
    @if (error()) { <div class="msg">{{ error() }}</div> }

    <div class="head list-head"><h3>À préparer</h3></div>
    <div class="items">
      @for (d of due(); track d.sub.id) {
        <div class="item due">
          <div class="info">
            <b>{{ d.sub.name }} · {{ dayName(d.sub.day) }} {{ d.date }}</b>
            <small>{{ itemsText(d.sub) }} · environ {{ money(estimate(d.sub)) }} · {{ d.sub.type === 'livraison' ? 'Livraison' : 'Retrait' }}</small>
          </div>
          <div class="item-actions">
            <button class="btn small" [disabled]="busy() === d.sub.id" (click)="create(d.sub, d.date)">Créer la commande</button>
          </div>
        </div>
      } @empty {
        @if (loaded()) { <div class="empty">Rien à préparer pour les deux prochains jours.</div> }
      }
    </div>

    <div class="head list-head"><h3>Tous les paniers ({{ subs().length }})</h3></div>
    <div class="items">
      @for (s of subs(); track s.id) {
        <div class="item" [class.off]="!s.active">
          <div class="info">
            <b>{{ s.name }} · {{ s.tel }} @if (!s.active) { <span class="pill">En pause</span> }</b>
            <small>Chaque {{ dayName(s.day) }} · prochaine fois le {{ next(s) }} · {{ itemsText(s) }}</small>
            @if (s.lastOrder) { <small>Dernière commande : {{ s.lastOrder }}</small> }
          </div>
          <div class="item-actions">
            <a class="btn light small" target="_blank" rel="noopener" [href]="waHref(s)">WhatsApp</a>
            <button class="btn light small" [disabled]="busy() === s.id" (click)="toggle(s)">{{ s.active ? 'Mettre en pause' : 'Reprendre' }}</button>
            <button class="btn danger small" [attr.aria-label]="'Supprimer le panier de ' + s.name" [disabled]="busy() === s.id" (click)="remove(s)">✕</button>
          </div>
        </div>
      } @empty {
        @if (loaded()) { <div class="empty">Aucun panier pour le moment. Les clients le choisissent au moment de commander.</div> }
      }
    </div>
  `,
  styles: `
    .hint { color: var(--muted); margin-bottom: 14px; max-width: 900px; }
    .list-head h3 { font-family: Inter, sans-serif; font-size: 1.05rem; }
    .item.due { border-color: #f3d27a; background: #fffaf0; }
    .info small { display: block; }
  `,
})
export class SubscriptionsAdmin implements OnInit {
  private readonly data = inject(AdminData);
  protected readonly subs = signal<Subscription[]>([]);
  private readonly products = signal<Product[]>([]);
  protected readonly loaded = signal(false);
  protected readonly busy = signal('');
  protected readonly error = signal('');
  private readonly today = localDay(new Date());
  protected readonly due = computed(() => duePanels(this.subs(), this.today));

  async ngOnInit() {
    try {
      await this.reload();
      this.products.set(await this.data.list<Product>('products'));
    } catch (e) {
      this.error.set((e as Error).message);
    }
    this.loaded.set(true);
  }

  private async reload() {
    this.subs.set((await this.data.listSubscriptions()).sort((a, b) => a.name.localeCompare(b.name, 'fr')));
  }

  protected dayName(d: number) {
    return DAY_NAMES.fr[d];
  }

  protected next(s: Subscription) {
    return nextDate(s.day, this.today);
  }

  protected money(n: number) {
    return `${formatNumber(Math.round(n))} DA`;
  }

  protected itemsText(s: Subscription) {
    return s.items.map(i => `${i.unit === 'kg' ? `${(i.grams ?? 0) * i.qty} g` : `${i.qty} ×`} ${i.name_fr}`).join(', ');
  }

  protected estimate(s: Subscription) {
    return refreshItems(s.items, this.products()).total;
  }

  protected waHref(s: Subscription) {
    const text = s.lang === 'ar'
      ? `السلام عليكم ${s.name}، سلتكم الأسبوعية ستكون جاهزة يوم ${DAY_NAMES.ar[s.day]}.`
      : `Bonjour ${s.name}, votre panier de la semaine sera prêt ${this.dayName(s.day)}.`;
    return `https://wa.me/${s.tel.replace(/\D/g, '').replace(/^0/, '213')}?text=${encodeURIComponent(text)}`;
  }

  private async run(id: string, task: () => Promise<unknown>, done: string) {
    this.busy.set(id);
    this.error.set('');
    try {
      await task();
      await this.reload();
      this.data.notify(done);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set('');
    }
  }

  protected create(s: Subscription, date: string) {
    return this.run(s.id, async () => {
      const { missing } = await this.data.createSubscriptionOrder(s, date, this.products());
      if (missing.length) this.error.set(`Commande créée sans : ${missing.join(', ')}. Prévenez le client.`);
    }, `Commande de ${s.name} créée`);
  }

  protected toggle(s: Subscription) {
    return this.run(s.id, () => this.data.updateSubscription(s.id, { active: !s.active }), s.active ? 'Panier en pause' : 'Panier repris');
  }

  protected remove(s: Subscription) {
    if (!confirm(`Supprimer le panier de la semaine de ${s.name} ?`)) return;
    return this.run(s.id, () => this.data.deleteSubscription(s.id), 'Panier supprimé');
  }
}
