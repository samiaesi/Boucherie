import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Category, Product, byOrder } from '../core/data';
import { IconPipe } from '../core/icon';
import { Lot } from '../core/lots';
import { localDay } from '../core/stats';
import { Amount, CutRecord, SHELF_LABELS, ShelfState, StockExit, chainSummary, exitLabel, shelfAlerts, shelfLines } from '../core/stock-chain';
import { AdminData } from './admin-data';
import { ChainSteps } from './chain-steps';

const DAYS = 7;

@Component({
  selector: 'app-chain',
  imports: [RouterLink, IconPipe, ChainSteps],
  template: `
    <div class="head"><h2>Chaîne du stock</h2></div>
    <app-chain-steps current="chaine" />
    <p class="hint">Du camion jusqu'au client : ce qui est entré, ce qui attend au frigo, ce qui est en rayon, ce qui est vendu et ce qui est sorti. Chiffres des {{ days }} derniers jours.</p>

    @if (error()) { <div class="msg">{{ error() }}</div> }

    @if (summary(); as s) {
      <div class="flow">
        <a class="step" routerLink="/admin/arrivages">
          <small>1 · Arrivages</small>
          <b>{{ amount(s.arrivals) }}</b>
          <span>{{ s.arrivals.count }} arrivage(s) reçu(s)</span>
          <em>Enregistrer un arrivage →</em>
        </a>
        <a class="step" routerLink="/admin/frigo" [class.warn]="s.fridge.alerts">
          <small>2 · Frigo</small>
          <b>{{ s.fridge.beasts }} bête(s)</b>
          <span>entières · {{ s.fridge.kg }} kg{{ s.fridge.alerts ? ' · ' + s.fridge.alerts + ' à recharger' : '' }}</span>
          <em>Ouvrir le frigo →</em>
        </a>
        <a class="step" routerLink="/admin/decoupe">
          <small>3 · Découpe</small>
          <b>{{ s.cuts.kg }} kg</b>
          <span>de coupes · {{ s.cuts.beasts }} bête(s) découpée(s)</span>
          <em>Découper une bête →</em>
        </a>
        <a class="step" href="#rayons" (click)="scrollTo($event)" [class.warn]="s.shelves.toFill">
          <small>4 · Rayons</small>
          <b>{{ s.shelves.onShelf }} en rayon</b>
          <span>{{ s.shelves.toFill }} à remplir · {{ s.shelves.off }} retiré(s)</span>
          <em>Remplir les rayons ↓</em>
        </a>
        <a class="step" routerLink="/admin/stock">
          <small>5 · Ventes</small>
          <b>{{ amount(s.sold) }}</b>
          <span>sorti par les commandes confirmées</span>
          <em>Voir le stock →</em>
        </a>
        <a class="step" routerLink="/admin/destockage" [class.loss]="s.exits.count">
          <small>6 · Déstockage</small>
          <b>{{ amount(s.exits) }}</b>
          <span>{{ s.exits.count }} sortie(s) sans vente</span>
          <em>Faire une sortie →</em>
        </a>
      </div>
      @if (s.exits.byReason.length) {
        <p class="reasons">Sorties : @for (r of s.exits.byReason; track r.reason) { <span>{{ reason(r.reason) }} {{ amount(r) }}</span> }</p>
      }
    }

    <section id="rayons">
      <div class="head list-head">
        <h3>Remplir les rayons</h3>
        <span class="legend">
          <i class="vide"></i>Rayon vide <i class="remplir"></i>À remplir <i class="vitrine"></i>En rayon <i class="retire"></i>Retiré
        </span>
      </div>
      <p class="hint">« Mettre en rayon » rend le produit visible sur le site. « Retirer » le cache sans toucher au stock. Un rayon vide se remplit par un arrivage.</p>

      <div class="tabs" role="tablist">
        <button role="tab" [class.on]="!rayon()" [attr.aria-selected]="!rayon()" (click)="rayon.set('')">Tous <span>{{ totalAlerts() || '' }}</span></button>
        @for (t of tabs(); track t.category.id) {
          @if (t.total) {
            <button role="tab" [class.on]="rayon() === t.category.id" [attr.aria-selected]="rayon() === t.category.id" (click)="rayon.set(t.category.id)">
              {{ t.category.name_fr }} @if (t.alerts) { <span>{{ t.alerts }}</span> }
            </button>
          }
        }
      </div>

      <div class="shelf">
        @for (l of shelf(); track l.product.id) {
          <div class="slot" [class]="'slot ' + l.state">
            <span class="pic">
              @if (l.product.image) { <img [src]="l.product.image" alt=""> } @else { <span [innerHTML]="iconOf(l.product) | icon"></span> }
            </span>
            <div class="what">
              <b>{{ l.product.name_fr }}</b>
              <small>{{ label(l.state) }}{{ l.qty !== null ? ' · ' + l.qty + ' ' + l.unit : ' · stock non suivi' }}</small>
            </div>
            <div class="acts">
              @if (l.state === 'retire') {
                <button class="btn small" [disabled]="busy() === l.product.id" (click)="shelve(l.product, true)">Mettre en rayon</button>
              } @else {
                @if (l.state === 'vide' || l.state === 'remplir') { <a class="btn small" routerLink="/admin/arrivages">Arrivage</a> }
                <button class="btn light small" [disabled]="busy() === l.product.id" (click)="shelve(l.product, false)">Retirer</button>
              }
            </div>
          </div>
        } @empty {
          <div class="empty">Aucun produit dans ce rayon.</div>
        }
      </div>
    </section>

    <section>
      <div class="head list-head"><h3>Derniers mouvements</h3></div>
      <div class="items">
        @for (m of moves(); track m.id) {
          <div class="item" [class.off]="m.cancelled">
            <span class="sign" [class.out]="m.out">{{ m.out ? '−' : '+' }}</span>
            <div class="info">
              <b>{{ m.matricule }} · {{ m.name }}</b>
              <small>{{ m.out ? '−' : '+' }}{{ m.qty }} {{ m.unit }} · {{ m.what }} · {{ m.date }}{{ m.cancelled ? ' · annulé' : '' }}</small>
            </div>
          </div>
        } @empty {
          @if (loaded()) { <div class="empty">Aucun mouvement enregistré.</div> }
        }
      </div>
    </section>
  `,
  styles: `
    .hint { color: var(--muted); margin: 0 0 14px; }
    .flow { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 10px; }
    .step { position: relative; display: grid; gap: 3px; padding: 14px 16px; color: inherit; text-decoration: none; background: #fff; border: 1px solid var(--line); border-top: 4px solid #2f7d4f; border-radius: 12px; }
    .step + .step::before { content: "→"; position: absolute; inset-inline-start: -13px; top: 50%; margin-top: -11px; color: #b8aea3; font-weight: 700; }
    .step.warn { border-top-color: var(--orange); }
    .step.loss { border-top-color: #a10c20; }
    .step small { color: var(--muted); font-size: .76rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
    .step b { font-size: 1.3rem; line-height: 1.2; }
    .step span { color: var(--muted); font-size: .84rem; }
    .step em { margin-top: 6px; color: #a10c20; font-style: normal; font-size: .82rem; font-weight: 600; }
    .step:hover { box-shadow: 0 8px 18px -12px rgba(0, 0, 0, .35); }
    .reasons { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0 0 22px; color: var(--muted); font-size: .86rem; }
    .reasons span { color: var(--ink, #1d1613); }
    section { margin-top: 26px; }
    .list-head h3 { font-family: Inter, sans-serif; font-size: 1.05rem; }
    .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; color: var(--muted); font-size: .8rem; }
    .legend i { display: inline-block; width: 10px; height: 10px; margin-inline-end: -5px; border-radius: 3px; }
    .vide { --c: #a10c20; } .remplir { --c: var(--orange); } .vitrine { --c: #2f7d4f; } .retire { --c: #bdb7af; }
    .legend i { background: var(--c); }
    .tabs { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 12px; padding-bottom: 4px; }
    .tabs button { flex: none; display: flex; align-items: center; gap: 6px; padding: 7px 13px; background: #fff; border: 1px solid var(--line); border-radius: 999px; font: inherit; font-size: .86rem; cursor: pointer; }
    .tabs button.on { background: #1d1613; border-color: #1d1613; color: #fff; }
    .tabs span { display: grid; place-items: center; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 999px; background: var(--orange); color: #fff; font-size: .72rem; font-weight: 700; }
    .shelf { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px; padding: 14px; background: linear-gradient(#f4efe9, #f4efe9) bottom / 100% 6px no-repeat, #fbf8f5; border: 1px solid var(--line); border-radius: 14px; }
    .slot { display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 9px; background: #fff; border-radius: 10px; box-shadow: inset 4px 0 0 var(--c), 0 1px 0 var(--line); }
    [dir="rtl"] .slot { box-shadow: inset -4px 0 0 var(--c), 0 1px 0 var(--line); }
    .slot.retire { opacity: .7; }
    .pic { display: grid; place-items: center; width: 56px; height: 46px; overflow: hidden; border-radius: 8px; background: var(--bg); }
    .pic img, .pic span, .pic :is(svg) { display: block; width: 100%; height: 100%; object-fit: cover; }
    .what { min-width: 0; }
    .what b { display: -webkit-box; font-size: .9rem; line-height: 1.25; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .what small { color: var(--c); font-size: .78rem; font-weight: 600; }
    .acts { display: flex; gap: 6px; }
    .sign { flex: none; display: grid; place-items: center; width: 30px; height: 30px; margin-inline-end: 10px; border-radius: 50%; background: #e3f1e8; color: #2f7d4f; font-weight: 700; }
    .sign.out { background: #f8e1e4; color: #a10c20; }
    .item { align-items: center; }
    .info small { display: block; }
    @media (max-width: 1200px) { .flow { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); } .step + .step::before { display: none; } }
  `,
})
export class Chain implements OnInit {
  protected readonly data = inject(AdminData);
  protected readonly days = DAYS;
  protected readonly lots = signal<Lot[]>([]);
  protected readonly exits = signal<StockExit[]>([]);
  protected readonly cuts = signal<CutRecord[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly rayon = signal('');
  protected readonly loaded = signal(false);
  protected readonly busy = signal('');
  protected readonly error = signal('');
  protected readonly label = (s: ShelfState) => SHELF_LABELS[s];
  protected readonly reason = exitLabel;

  protected readonly summary = computed(() => chainSummary({
    lots: this.lots(), exits: this.exits(), cuts: this.cuts(), fridge: this.data.fridge(), products: this.data.products(), orders: this.data.orders(),
    today: localDay(new Date()), days: DAYS,
  }));
  protected readonly tabs = computed(() => shelfAlerts(this.data.products(), this.data.fridge(), this.categories()));
  protected readonly totalAlerts = computed(() => this.tabs().reduce((sum, t) => sum + t.alerts, 0));
  protected readonly shelf = computed(() => shelfLines([...this.data.products()].sort(byOrder), this.data.fridge(), this.rayon()));

  /** Arrivages et sorties mêlés, du plus récent au plus ancien */
  protected readonly moves = computed(() => [
    ...this.lots().map(l => ({ id: l.id, matricule: l.matricule, name: l.target.name, qty: l.qty, unit: l.target.unit, date: l.arrivalDate, out: false, cancelled: !!l.cancelled, what: l.supplierName || 'Arrivage' })),
    ...this.exits().map(e => ({ id: e.id, matricule: e.matricule, name: e.target.name, qty: e.qty, unit: e.target.unit, date: e.date, out: true, cancelled: !!e.cancelled, what: exitLabel(e.reason) })),
    ...this.cuts().map(c => ({ id: c.id, matricule: c.matricule, name: c.reserve.name, qty: c.kg, unit: 'kg', date: c.date, out: true, cancelled: !!c.cancelled, what: `découpe de ${c.beasts} bête(s), os ${c.waste} kg` })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12));

  async ngOnInit() {
    try {
      const [register, categories] = await Promise.all([this.data.listRegister(), this.data.getCategories()]);
      this.lots.set(register.lots);
      this.exits.set(register.exits);
      this.cuts.set(register.cuts);
      this.categories.set(categories);
    } catch (e) {
      this.error.set((e as Error).message);
    }
    this.loaded.set(true);
  }

  protected amount(a: Amount) {
    const parts = [a.kg ? `${a.kg} kg` : '', a.pieces ? `${a.pieces} pièce(s)` : ''].filter(Boolean);
    return parts.join(' · ') || '0 kg';
  }

  protected iconOf(p: Product) {
    return this.categories().find(c => c.id === p.category)?.icon ?? 'boeuf';
  }

  protected scrollTo(e: Event) {
    e.preventDefault();
    document.getElementById('rayons')?.scrollIntoView({ behavior: 'smooth' });
  }

  protected async shelve(p: Product, on: boolean) {
    this.busy.set(p.id);
    this.error.set('');
    try {
      await this.data.setOnShelf(p, on);
      this.data.notify(on ? `${p.name_fr} est en rayon` : `${p.name_fr} retiré du rayon`);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set('');
    }
  }
}
