import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { roundStock, wholeLeft } from '../core/data';
import { Lot, LotTarget, lotTargets } from '../core/lots';
import { localDay } from '../core/stats';
import { CutRecord, EXIT_REASONS, ExitReason, StockExit, availableQty, beastWeight, exitLabel, searchExits, targetCountries } from '../core/stock-chain';
import { AdminData } from './admin-data';
import { ChainSteps } from './chain-steps';

const blank = () => ({
  target: null as LotTarget | null, qty: null as number | null, beasts: null as number | null, date: localDay(new Date()), reason: 'perte' as ExitReason, origin: '', lot: '', note: '',
});

@Component({
  selector: 'app-destock',
  imports: [FormsModule, ChainSteps],
  template: `
    <div class="head"><h2>Déstockage</h2></div>
    <app-chain-steps current="destockage" />
    <p class="hint">Tout ce qui sort du stock sans être vendu : pertes, date dépassée, os de découpe, repas du personnel, retour au fournisseur, don. Les ventes, elles, sortent toutes seules quand une commande est confirmée.</p>

    <form class="card-box" #f="ngForm" (ngSubmit)="save(f)">
      <div class="reasons" role="radiogroup" aria-label="Motif de la sortie">
        @for (r of reasons; track r.id) {
          <label class="reason" [class.on]="draft.reason === r.id">
            <input type="radio" name="reason" [value]="r.id" [(ngModel)]="draft.reason">
            <b>{{ r.label }}</b><small>{{ r.hint }}</small>
          </label>
        }
      </div>
      <div class="grid2">
        <label>Article retiré
          <select name="target" required [(ngModel)]="draft.target" (ngModelChange)="draft.origin = ''; draft.beasts = null">
            <option [ngValue]="null">Choisir…</option>
            @for (t of targets(); track t.kind + t.id) { <option [ngValue]="t">{{ t.name }} ({{ t.unit }})</option> }
          </select>
        </label>
        @if (countries().length) {
          <label>Pays du stock retiré
            <select name="origin" required [(ngModel)]="draft.origin">
              <option value="">Choisir…</option>
              @for (c of countries(); track c) { <option [value]="c">{{ c }}</option> }
            </select>
          </label>
        }
        @if (draft.target?.kind === 'fridge') {
          <label>Bêtes entières retirées
            <input name="beasts" type="number" min="0.5" step="0.5" required [(ngModel)]="draft.beasts" (ngModelChange)="suggestKg()">
            <small class="left">Il reste {{ beastsLeft() }} bête(s) entière(s). Pour une coupe abîmée, choisissez la coupe dans la liste.</small>
          </label>
        }
        <label>Quantité retirée {{ draft.target ? '(' + draft.target.unit + ')' : '' }}
          <input name="qty" type="number" min="0.01" step="0.01" required [(ngModel)]="draft.qty">
          @if (draft.target) { <small class="left">En stock : {{ left() }} {{ draft.target.unit }}</small> }
        </label>
        <label>Date<input name="date" type="date" required [(ngModel)]="draft.date"></label>
        <label>Arrivage concerné (facultatif)
          <input name="lot" list="lot-numbers" autocomplete="off" placeholder="LOT-2026-0001" [(ngModel)]="draft.lot">
          <datalist id="lot-numbers">@for (l of lotsFor(); track l.id) { <option [value]="l.matricule">{{ l.target.name }} · {{ l.arrivalDate }}</option> }</datalist>
        </label>
        <label>Note (facultatif)<input name="note" placeholder="Ex. coupure de courant samedi" [(ngModel)]="draft.note"></label>
      </div>
      @if (error()) { <div class="msg">{{ error() }}</div> }
      <div class="form-actions"><button class="btn" type="submit" [disabled]="f.invalid || busy()">{{ busy() ? 'Enregistrement…' : 'Retirer du stock' }}</button></div>
    </form>

    @if (totals().length) {
      <div class="totals">
        <b>Ce mois-ci</b>
        @for (t of totals(); track t.reason) { <span>{{ t.label }} : {{ t.text }}</span> }
      </div>
    }

    <div class="head list-head">
      <h3>Historique des sorties</h3>
      <input type="search" placeholder="Matricule, article, motif…" aria-label="Rechercher une sortie" [ngModel]="search()" (ngModelChange)="search.set($event)" name="search">
    </div>
    <div class="items">
      @for (e of shown(); track e.id) {
        <div class="item" [class.off]="e.cancelled">
          <div class="info">
            <b>{{ e.matricule }} · {{ label(e.reason) }} @if (e.cancelled) { <span class="pill alert">Annulée</span> }</b>
            <small>{{ e.target.name }} · {{ e.beasts ? '−' + e.beasts + ' bête(s) · ' : '' }}−{{ e.qty }} {{ e.target.unit }}{{ e.origin ? ' · ' + e.origin : '' }} · le {{ e.date }}</small>
            @if (e.lot || e.note) { <small>{{ e.lot ? 'Arrivage ' + e.lot : '' }}{{ e.lot && e.note ? ' · ' : '' }}{{ e.note }}</small> }
          </div>
          @if (!e.cancelled) { <button class="btn light small" (click)="cancel(e)" [disabled]="busy()">Annuler</button> }
        </div>
      } @empty {
        @if (loaded()) { <div class="empty">{{ search() ? 'Aucune sortie trouvée.' : 'Aucune sortie enregistrée pour le moment.' }}</div> }
      }
    </div>
  `,
  styles: `
    .hint { color: var(--muted); margin-bottom: 16px; }
    .card-box { max-width: 900px; margin-bottom: 18px; }
    .reasons { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; margin-bottom: 14px; }
    .reason { display: grid; gap: 2px; margin: 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; cursor: pointer; }
    .reason input { position: absolute; opacity: 0; pointer-events: none; }
    .reason b { font-size: .9rem; }
    .reason small { color: var(--muted); font-size: .76rem; font-weight: 400; }
    .reason.on { border-color: #a10c20; background: #fbeef0; box-shadow: inset 0 0 0 1px #a10c20; }
    .reason:has(input:focus-visible) { outline: 2px solid #a10c20; outline-offset: 2px; }
    .left { color: var(--muted); font-weight: 400; }
    .totals { display: flex; flex-wrap: wrap; gap: 6px 16px; max-width: 900px; margin-bottom: 22px; padding: 10px 14px; background: #fff; border: 1px solid var(--line); border-radius: 10px; font-size: .88rem; }
    .list-head h3 { font-family: Inter, sans-serif; font-size: 1.05rem; }
    .list-head input { max-width: 300px; }
    .info small { display: block; }
  `,
})
export class Destock implements OnInit {
  private readonly data = inject(AdminData);
  protected readonly reasons = EXIT_REASONS;
  protected readonly label = exitLabel;
  protected readonly lots = signal<Lot[]>([]);
  protected readonly exits = signal<StockExit[]>([]);
  protected readonly cutWastes = signal<CutRecord[]>([]);
  protected readonly loaded = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected draft = blank();

  protected readonly targets = computed(() => lotTargets(this.data.products(), this.data.fridge()));
  protected readonly shown = computed(() => searchExits(this.exits(), this.search()));

  protected countries() {
    return targetCountries(this.draft.target, this.data.fridge(), this.data.products());
  }

  private reserve() {
    const t = this.draft.target;
    return t?.kind === 'fridge' ? this.data.fridge().find(f => f.id === t.id) : undefined;
  }

  protected beastsLeft() {
    const r = this.reserve();
    return r ? wholeLeft(r, this.draft.origin && r.wholeBy ? this.draft.origin : undefined) : 0;
  }

  protected suggestKg() {
    const r = this.reserve();
    const n = Number(this.draft.beasts) || 0;
    if (r && n) this.draft.qty = roundStock(n * beastWeight(r, this.draft.origin && r.wholeBy ? this.draft.origin : undefined));
  }

  protected left() {
    const t = this.draft.target;
    return t ? roundStock(availableQty(t, this.data.fridge(), this.data.products(), this.draft.origin || undefined)) : 0;
  }

  protected lotsFor() {
    const t = this.draft.target;
    return this.lots().filter(l => !l.cancelled && (!t || (l.target.kind === t.kind && l.target.id === t.id))).slice(0, 30);
  }

  /** Totaux du mois en cours, par motif */
  protected readonly totals = computed(() => {
    const month = localDay(new Date()).slice(0, 7);
    const sums = new Map<ExitReason, { kg: number; pieces: number }>();
    for (const c of this.cutWastes()) {
      if (c.cancelled || !c.waste || !c.date.startsWith(month)) continue;
      const s = sums.get('decoupe') ?? { kg: 0, pieces: 0 };
      s.kg = roundStock(s.kg + c.waste);
      sums.set('decoupe', s);
    }
    for (const e of this.exits()) {
      if (e.cancelled || !e.date.startsWith(month)) continue;
      const s = sums.get(e.reason) ?? { kg: 0, pieces: 0 };
      if (e.target.unit === 'kg') s.kg = roundStock(s.kg + e.qty); else s.pieces = roundStock(s.pieces + e.qty);
      sums.set(e.reason, s);
    }
    return [...sums].map(([reason, s]) => ({
      reason, label: exitLabel(reason), text: [s.kg ? `${s.kg} kg` : '', s.pieces ? `${s.pieces} pièce(s)` : ''].filter(Boolean).join(' · '),
    }));
  });

  async ngOnInit() {
    try {
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    }
    this.loaded.set(true);
  }

  private async reload() {
    const { lots, exits, cuts } = await this.data.listRegister();
    this.cutWastes.set(cuts);
    this.lots.set(lots);
    this.exits.set(exits);
  }

  protected async save(form: NgForm) {
    const { target, qty, date, reason, origin, lot, note } = this.draft;
    if (!target || !qty) return;
    const beasts = target.kind === 'fridge' ? Number(this.draft.beasts) || 0 : 0;
    if (target.kind === 'fridge' && !beasts) {
      this.error.set('Indiquez combien de bêtes entières sortent.');
      return;
    }
    if (this.countries().length && !origin) {
      this.error.set('Choisissez le pays du stock retiré.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const matricule = await this.data.addExit({
        target, qty: Number(qty), date, reason, note: note.trim(), ...(beasts ? { beasts } : {}),
        ...(origin ? { origin } : {}), ...(lot.trim() ? { lot: lot.trim().toUpperCase() } : {}),
      });
      this.data.notify(`Sortie enregistrée : ${matricule}`);
      this.draft = blank();
      form.resetForm(blank());
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async cancel(e: StockExit) {
    if (!confirm(`Annuler ${e.matricule} ? ${e.qty} ${e.target.unit} de ${e.target.name} reviendront en stock.`)) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.data.cancelExit(e);
      this.data.notify(`${e.matricule} annulée, stock remis`);
      await this.reload();
    } catch (err) {
      this.error.set((err as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
