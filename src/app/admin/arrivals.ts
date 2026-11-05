import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Lot, LotTarget, lotTargets, searchLots, supplierNames } from '../core/lots';
import { localDay } from '../core/stats';
import { AdminData } from './admin-data';

const blank = () => ({
  target: null as LotTarget | null, qty: null as number | null, arrivalDate: localDay(new Date()), supplierName: '', supplierRef: '', note: '',
});

@Component({
  selector: 'app-arrivals',
  imports: [FormsModule],
  template: `
    <div class="head"><h2>Arrivages</h2></div>
    <p class="hint">Chaque arrivage reçoit un matricule et s'ajoute automatiquement au stock.</p>

    <form class="card-box" #f="ngForm" (ngSubmit)="save(f)">
      <div class="grid2">
        <label>Article reçu
          <select name="target" required [(ngModel)]="draft.target">
            <option [ngValue]="null">Choisir…</option>
            @for (t of targets(); track t.kind + t.id) { <option [ngValue]="t">{{ t.name }} ({{ t.unit }})</option> }
          </select>
        </label>
        <label>Quantité reçue {{ draft.target ? '(' + draft.target.unit + ')' : '' }}
          <input name="qty" type="number" min="0.01" step="0.01" required [(ngModel)]="draft.qty">
        </label>
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
      <div><button class="btn" type="submit" [disabled]="f.invalid || busy()">{{ busy() ? 'Enregistrement…' : 'Enregistrer l\\'arrivage' }}</button></div>
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
            <small>{{ l.target.name }} · {{ l.qty }} {{ l.target.unit }} · arrivé le {{ l.arrivalDate }}</small>
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

  protected readonly targets = computed(() => lotTargets(this.data.products(), this.data.fridge()));
  protected readonly suppliers = computed(() => supplierNames(this.lots()));
  protected readonly shown = computed(() => searchLots(this.lots(), this.search()));

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
    const { target, qty, arrivalDate, supplierName, supplierRef, note } = this.draft;
    if (!target || !qty) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const matricule = await this.data.addLot({
        target, qty: Number(qty), arrivalDate, supplierName: supplierName.trim(), supplierRef: supplierRef.trim(), note: note.trim(),
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
    if (!confirm(`Annuler ${l.matricule} ? ${l.qty} ${l.target.unit} seront retirés du stock.`)) return;
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
