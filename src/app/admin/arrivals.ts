import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { COUNTRIES, formatNumber, roundStock } from '../core/data';
import { BeastLine, Lot, LotTarget, linesCost, lotOrigins, lotTargets, searchLots, supplierNames } from '../core/lots';
import { localDay } from '../core/stats';
import { AdminData } from './admin-data';
import { ChainSteps } from './chain-steps';

/** Ligne du formulaire : les champs restent vides tant qu'ils ne sont pas remplis */
interface Row { kg: number | null; origin: string; price: number | null }

const MAX_BEASTS = 200;

const blank = () => ({
  target: null as LotTarget | null, qty: null as number | null, price: null as number | null, count: null as number | null,
  arrivalDate: localDay(new Date()), supplierName: '', supplierRef: '', note: '', origin: '',
});

@Component({
  selector: 'app-arrivals',
  imports: [FormsModule, ChainSteps],
  template: `
    <div class="head"><h2>Arrivages</h2></div>
    <app-chain-steps current="arrivages" />
    <p class="hint">Chaque arrivage reçoit un matricule et s'ajoute automatiquement au stock de son pays.</p>

    <form class="card-box" #f="ngForm" (ngSubmit)="save(f)">
      <datalist id="lot-countries">@for (c of countries; track c.fr) { <option [value]="c.fr"></option> }</datalist>
      <div class="grid2">
        <label>Article reçu
          <select name="target" required [(ngModel)]="draft.target">
            <option [ngValue]="null">Choisir…</option>
            @for (t of targets(); track t.kind + t.id) { <option [ngValue]="t">{{ t.name }} ({{ t.unit }})</option> }
          </select>
        </label>
        @if (isBeasts()) {
          <label>Nombre de bêtes reçues
            <input name="count" type="number" min="1" [max]="maxBeasts" step="1" required [(ngModel)]="draft.count" (ngModelChange)="resize($event)">
          </label>
        } @else {
          <label>Quantité reçue {{ draft.target ? '(' + draft.target.unit + ')' : '' }}
            <input name="qty" type="number" min="0.01" step="0.01" required [(ngModel)]="draft.qty">
          </label>
          <label>Pays d'origine
            <input name="origin" list="lot-countries" autocomplete="off" required placeholder="Algérie, Espagne…" [(ngModel)]="draft.origin">
          </label>
          <label>Prix d'achat (DA / {{ draft.target?.unit === 'kg' ? 'kg' : 'pièce' }}, facultatif)
            <input name="price" type="number" min="0" step="10" [(ngModel)]="draft.price">
          </label>
        }
      </div>

      @if (isBeasts() && rows.length) {
        <div class="beasts">
          <div class="beast titles" aria-hidden="true"><span>N°</span><span>Poids (kg)</span><span>Pays</span><span>Prix d'achat (DA / kg)</span><span>Coût</span></div>
          @for (r of rows; track $index; let i = $index) {
            <div class="beast">
              <span class="num">{{ i + 1 }}</span>
              <input [name]="'kg' + i" type="number" min="0.1" step="0.1" required placeholder="22" [attr.aria-label]="'Poids de la bête ' + (i + 1)" [(ngModel)]="r.kg">
              <input [name]="'origin' + i" list="lot-countries" autocomplete="off" required placeholder="Algérie" [attr.aria-label]="'Pays de la bête ' + (i + 1)" [(ngModel)]="r.origin">
              <input [name]="'price' + i" type="number" min="0" step="10" placeholder="1400" [attr.aria-label]="'Prix au kg de la bête ' + (i + 1)" [(ngModel)]="r.price">
              <span class="cost">{{ r.kg && r.price ? money(r.kg * r.price) : '—' }}</span>
            </div>
          }
          @if (rows.length > 1) {
            <button type="button" class="link-btn" (click)="copyFirst()">Mettre le pays et le prix de la bête n° 1 sur toutes les lignes</button>
          }
          <div class="totals">
            <span><b>{{ rows.length }}</b> bête(s)</span>
            <span><b>{{ totalKg() }}</b> kg</span>
            @if (average()) { <span>moyenne <b>{{ average() }}</b> kg</span> }
            @if (totalCost()) { <span>coût <b>{{ money(totalCost()) }}</b></span><span>soit <b>{{ money(avgPrice()) }}</b> / kg</span> }
          </div>
        </div>
      }

      <div class="grid2">
        <label>Date d'arrivée<input name="date" type="date" required [(ngModel)]="draft.arrivalDate"></label>
        <label>Nom du fournisseur
          <input name="supplier" required list="suppliers" autocomplete="off" [(ngModel)]="draft.supplierName">
          <datalist id="suppliers">@for (s of suppliers(); track s) { <option [value]="s"></option> }</datalist>
        </label>
        <label>Référence du fournisseur
          <input name="ref" required placeholder="Bon de livraison, facture…" [(ngModel)]="draft.supplierRef">
        </label>
        <label>Note (facultatif)<input name="note" [(ngModel)]="draft.note"></label>
      </div>
      @if (error()) { <div class="msg">{{ error() }}</div> }
      <div class="form-actions"><button class="btn" type="submit" [disabled]="f.invalid || busy()">{{ busy() ? 'Enregistrement…' : 'Enregistrer l\\'arrivage' }}</button></div>
    </form>

    <div class="head list-head">
      <h3>Historique</h3>
      <input type="search" placeholder="Matricule, fournisseur, pays…" aria-label="Rechercher un arrivage" [ngModel]="search()" (ngModelChange)="search.set($event)" name="search">
    </div>
    <div class="items">
      @for (l of shown(); track l.id) {
        <div class="item" [class.off]="l.cancelled">
          <div class="info">
            <b>{{ l.matricule }} @if (l.cancelled) { <span class="pill alert">Annulé</span> }</b>
            <small>{{ l.target.name }} · {{ l.beasts ? l.beasts + ' bête(s) · ' : '' }}{{ l.qty }} {{ l.target.unit }}{{ l.beasts ? ' (moyenne ' + avgOf(l) + ' kg)' : '' }}{{ origins(l) ? ' · ' + origins(l) : '' }} · arrivé le {{ l.arrivalDate }}</small>
            @if (l.cost) { <small>Coût d'achat : {{ money(l.cost) }} · {{ money(l.cost / l.qty) }} / {{ l.target.unit }}</small> }
            @if (l.lines?.length) {
              <details>
                <summary>Voir les {{ l.lines!.length }} bêtes</summary>
                <ol>@for (b of l.lines; track $index) { <li>{{ b.kg }} kg · {{ b.origin }}{{ b.price ? ' · ' + money(b.price) + ' / kg' : '' }}</li> }</ol>
              </details>
            }
            <small>{{ l.supplierName }} · réf. {{ l.supplierRef }}{{ l.note ? ' · ' + l.note : '' }}</small>
          </div>
          @if (!l.cancelled) { <button class="btn danger small" (click)="cancel(l)" [disabled]="busy()">Annuler</button> }
        </div>
      } @empty {
        @if (loaded()) { <div class="empty">{{ search() ? 'Aucun arrivage trouvé.' : 'Aucun arrivage enregistré pour le moment.' }}</div> }
      }
    </div>
  `,
  styles: `
    .hint { color: var(--muted); margin-bottom: 16px; }
    .card-box { max-width: 900px; margin-bottom: 24px; display: grid; gap: 14px; }
    .card-box .grid2 > label { align-content: start; }
    .list-head h3 { font-family: Inter, sans-serif; font-size: 1.05rem; }
    .list-head input { max-width: 300px; }
    .info small { display: block; }
    .beasts { display: grid; gap: 6px; padding: 12px 14px; background: var(--bg); border-radius: 12px; }
    .beast { display: grid; grid-template-columns: 34px minmax(80px, 1fr) minmax(120px, 1.5fr) minmax(110px, 1.2fr) 110px; gap: 8px; align-items: center; }
    .beast.titles { color: var(--muted); font-size: .78rem; font-weight: 600; }
    .num { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: #fff; font-weight: 700; font-size: .85rem; }
    .cost { color: var(--muted); font-size: .86rem; text-align: end; white-space: nowrap; }
    .link-btn { justify-self: start; padding: 0; border: 0; background: none; color: #a10c20; font: inherit; font-size: .84rem; cursor: pointer; text-decoration: underline; }
    .totals { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 4px; padding-top: 8px; border-top: 1px dashed var(--line); font-size: .9rem; }
    details { margin: 2px 0; font-size: .84rem; }
    summary { color: #a10c20; cursor: pointer; }
    ol { margin: 4px 0; padding-inline-start: 22px; color: var(--muted); }
    @media (max-width: 700px) {
      .beast { grid-template-columns: 30px 1fr 1fr; }
      .beast.titles { display: none; }
      .beast input[name^='price'] { grid-column: 2; }
      .cost { grid-column: 3; text-align: start; }
    }
  `,
})
export class Arrivals implements OnInit {
  private readonly data = inject(AdminData);
  protected readonly lots = signal<Lot[]>([]);
  protected readonly loaded = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly maxBeasts = MAX_BEASTS;
  protected draft = blank();
  protected rows: Row[] = [];
  protected readonly countries = COUNTRIES;
  protected readonly origins = lotOrigins;

  protected readonly targets = computed(() => lotTargets(this.data.products(), this.data.fridge()));
  protected readonly suppliers = computed(() => supplierNames(this.lots()));
  protected readonly shown = computed(() => searchLots(this.lots(), this.search()));

  protected isBeasts() {
    return this.draft.target?.kind === 'fridge';
  }

  /** Une ligne par bête ; une nouvelle ligne reprend le pays et le prix de la précédente. */
  protected resize(count: number | null) {
    const n = Math.min(MAX_BEASTS, Math.max(0, Math.floor(Number(count) || 0)));
    const last = this.rows.at(-1);
    while (this.rows.length < n) this.rows.push({ kg: null, origin: last?.origin ?? '', price: last?.price ?? null });
    this.rows.length = n;
  }

  protected copyFirst() {
    const [first] = this.rows;
    this.rows.forEach(r => { r.origin = first.origin; r.price = first.price; });
  }

  private lines(): BeastLine[] {
    return this.rows.map(r => ({
      kg: roundStock(Number(r.kg) || 0), origin: r.origin.trim(), ...(Number(r.price) > 0 ? { price: Number(r.price) } : {}),
    }));
  }

  protected totalKg() {
    return roundStock(this.rows.reduce((sum, r) => sum + (Number(r.kg) || 0), 0));
  }

  protected average() {
    return this.rows.length && this.totalKg() ? roundStock(this.totalKg() / this.rows.length) : 0;
  }

  protected totalCost() {
    return linesCost(this.lines());
  }

  /** Prix moyen au kg, sur les bêtes dont le prix est connu */
  protected avgPrice() {
    const priced = this.lines().filter(l => l.price);
    const kg = priced.reduce((sum, l) => sum + l.kg, 0);
    return kg ? Math.round(this.totalCost() / kg) : 0;
  }

  protected money(n: number) {
    return `${formatNumber(Math.round(n))} DA`;
  }

  protected avgOf(l: Lot) {
    return l.beasts ? roundStock(l.qty / l.beasts) : 0;
  }

  async ngOnInit() {
    try {
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    }
    this.loaded.set(true);
  }

  private async reload() {
    this.lots.set(await this.data.listLots());
  }

  protected async save(form: NgForm) {
    const { target, arrivalDate, supplierName, supplierRef, note } = this.draft;
    if (!target) return;
    const common = { target, arrivalDate, supplierName: supplierName.trim(), supplierRef: supplierRef.trim(), note: note.trim() };
    let input;
    if (this.isBeasts()) {
      const lines = this.lines();
      if (!lines.length || lines.some(l => !l.kg || !l.origin)) {
        this.error.set('Indiquez le poids et le pays de chaque bête.');
        return;
      }
      const origins = [...new Set(lines.map(l => l.origin))];
      const cost = linesCost(lines);
      input = {
        ...common, qty: this.totalKg(), beasts: lines.length, lines,
        ...(origins.length === 1 ? { origin: origins[0] } : {}), ...(cost ? { cost } : {}),
      };
    } else {
      const qty = Number(this.draft.qty) || 0;
      const origin = this.draft.origin.trim();
      const price = Number(this.draft.price) || 0;
      if (!qty || !origin) {
        this.error.set('Indiquez la quantité et le pays d\'origine.');
        return;
      }
      input = { ...common, qty, origin, ...(price ? { price, cost: Math.round(qty * price) } : {}) };
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const matricule = await this.data.addLot(input);
      this.data.notify(`Arrivage enregistré : ${matricule}`);
      this.draft = blank();
      this.rows = [];
      form.resetForm(blank());
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async cancel(l: Lot) {
    if (!confirm(`Annuler ${l.matricule} ? ${l.beasts ? l.beasts + ' bête(s), ' : ''}${l.qty} ${l.target.unit} seront retirés du stock.`)) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.data.cancelLot(l);
      this.data.notify(`${l.matricule} annulé`);
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
