import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { COUNTRIES } from '../core/data';
import { roundStock } from '../core/data';
import { Lot, LotTarget, lotTargets, parseWeights, searchLots, supplierNames } from '../core/lots';
import { localDay } from '../core/stats';
import { AdminData } from './admin-data';
import { ChainSteps } from './chain-steps';

const blank = () => ({
  target: null as LotTarget | null, qty: null as number | null, beasts: null as number | null, weights: '', arrivalDate: localDay(new Date()), supplierName: '', supplierRef: '', note: '', origin: '',
});

@Component({
  selector: 'app-arrivals',
  imports: [FormsModule, ChainSteps],
  template: `
    <div class="head"><h2>Arrivages</h2></div>
    <app-chain-steps current="arrivages" />
    <p class="hint">Chaque arrivage reçoit un matricule et s'ajoute automatiquement au stock de son pays.</p>

    <form class="card-box" #f="ngForm" (ngSubmit)="save(f)">
      <div class="grid2">
        <label>Article reçu
          <select name="target" required [(ngModel)]="draft.target">
            <option [ngValue]="null">Choisir…</option>
            @for (t of targets(); track t.kind + t.id) { <option [ngValue]="t">{{ t.name }} ({{ t.unit }})</option> }
          </select>
        </label>
        @if (draft.target?.kind === 'fridge') {
          <label>Nombre de bêtes reçues
            <input name="beasts" type="number" min="1" step="1" required [disabled]="weighed().length > 0" [ngModel]="weighed().length || draft.beasts" (ngModelChange)="draft.beasts = $event">
          </label>
          <label class="wide">Poids de chaque bête en kg (facultatif)
            <input name="weights" placeholder="21 23,5 24 22" autocomplete="off" [(ngModel)]="draft.weights">
            <small class="why">Séparez les poids par un espace. Le site compte les bêtes et fait la somme tout seul.</small>
          </label>
        }
        <label>Poids total reçu {{ draft.target ? '(' + draft.target.unit + ')' : '' }}
          <input name="qty" type="number" min="0.01" step="0.01" required [disabled]="weighed().length > 0" [ngModel]="weighed().length ? weighedTotal() : draft.qty" (ngModelChange)="draft.qty = $event">
          @if (draft.target?.kind === 'fridge' && average(); as avg) { <small class="why">Moyenne : {{ avg }} kg par bête</small> }
        </label>
        <label>Date d'arrivée<input name="date" type="date" required [(ngModel)]="draft.arrivalDate"></label>
        <label>Nom du fournisseur
          <input name="supplier" required list="suppliers" autocomplete="off" [(ngModel)]="draft.supplierName">
          <datalist id="suppliers">@for (s of suppliers(); track s) { <option [value]="s"></option> }</datalist>
        </label>
        <label>Référence du fournisseur
          <input name="ref" required placeholder="Bon de livraison, facture…" [(ngModel)]="draft.supplierRef">
        </label>
        <label>Pays d'origine de la viande
          <input name="origin" list="lot-countries" autocomplete="off" required placeholder="Algérie, Espagne…" [(ngModel)]="draft.origin">
          <small class="why">Obligatoire : chaque pays a son propre stock, pour que les ventes et le déstockage retirent le bon.</small>
          <datalist id="lot-countries">@for (c of countries; track c.fr) { <option [value]="c.fr"></option> }</datalist>
        </label>
        <label>Note (facultatif)<input name="note" [(ngModel)]="draft.note"></label>
      </div>
      @if (error()) { <div class="msg">{{ error() }}</div> }
      <div class="form-actions"><button class="btn" type="submit" [disabled]="f.invalid || busy()">{{ busy() ? 'Enregistrement…' : 'Enregistrer l\\'arrivage' }}</button></div>
    </form>

    <div class="head list-head">
      <h3>Historique</h3>
      <input type="search" placeholder="Matricule, fournisseur, référence…" aria-label="Rechercher un arrivage" [ngModel]="search()" (ngModelChange)="search.set($event)" name="search">
    </div>
    <div class="items">
      @for (l of shown(); track l.id) {
        <div class="item" [class.off]="l.cancelled">
          <div class="info">
            <b>{{ l.matricule }} @if (l.cancelled) { <span class="pill alert">Annulé</span> }</b>
            <small>{{ l.target.name }} · {{ l.beasts ? l.beasts + ' bête(s) · ' : '' }}{{ l.qty }} {{ l.target.unit }}{{ l.beasts ? ' (moyenne ' + avgOf(l) + ' kg)' : '' }}{{ l.origin ? ' · ' + l.origin : '' }} · arrivé le {{ l.arrivalDate }}</small>
            @if (l.weights?.length) { <small>Poids : {{ l.weights.join(' · ') }} kg</small> }
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
    .card-box { max-width: 900px; margin-bottom: 24px; }
    .list-head h3 { font-family: Inter, sans-serif; font-size: 1.05rem; }
    .list-head input { max-width: 300px; }
    .info small { display: block; }
    .why { color: var(--muted); font-size: .78rem; font-weight: 400; }
    .card-box .grid2 > label { align-content: start; }
    .wide { grid-column: 1 / -1; }
  `,
})
export class Arrivals implements OnInit {
  private readonly data = inject(AdminData);
  protected readonly lots = signal<Lot[]>([]);
  protected readonly loaded = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected draft = blank();
  protected readonly countries = COUNTRIES;

  protected readonly targets = computed(() => lotTargets(this.data.products(), this.data.fridge()));
  protected readonly suppliers = computed(() => supplierNames(this.lots()));
  protected readonly shown = computed(() => searchLots(this.lots(), this.search()));

  /** Poids tapés un par un */
  protected weighed() {
    return this.draft.target?.kind === 'fridge' ? parseWeights(this.draft.weights) : [];
  }

  protected weighedTotal() {
    return roundStock(this.weighed().reduce((sum, w) => sum + w, 0));
  }

  protected average() {
    const n = this.weighed().length || Number(this.draft.beasts) || 0;
    const total = this.weighed().length ? this.weighedTotal() : Number(this.draft.qty) || 0;
    return n && total ? roundStock(total / n) : 0;
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
    const { target, arrivalDate, supplierName, supplierRef, note, origin } = this.draft;
    const weights = this.weighed();
    const qty = weights.length ? this.weighedTotal() : Number(this.draft.qty) || 0;
    const beasts = target?.kind === 'fridge' ? weights.length || Math.round(Number(this.draft.beasts) || 0) : 0;
    if (!target || !qty) return;
    if (target.kind === 'fridge' && !beasts) {
      this.error.set('Indiquez le nombre de bêtes reçues.');
      return;
    }
    if (!origin.trim()) {
      this.error.set('Indiquez le pays d\'origine de cet arrivage.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const matricule = await this.data.addLot({
        target, qty, arrivalDate, ...(beasts ? { beasts } : {}), ...(weights.length ? { weights } : {}), supplierName: supplierName.trim(), supplierRef: supplierRef.trim(), note: note.trim(), ...(origin.trim() ? { origin: origin.trim() } : {}),
      });
      this.data.notify(`Arrivage enregistré : ${matricule}`);
      this.draft = blank();
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
