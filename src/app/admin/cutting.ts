import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FridgeItem, isCabinet, roundStock, wholeLeft } from '../core/data';
import { localDay } from '../core/stats';
import { CutRecord, beastWeight, cutWaste, cutsOf, reserveCountries } from '../core/stock-chain';
import { AdminData } from './admin-data';
import { ChainSteps } from './chain-steps';

const blank = (reserve = '') => ({
  reserve, origin: '', beasts: 1 as number | null, kg: null as number | null, date: localDay(new Date()), note: '',
  pieces: {} as Record<string, number | null>,
});

@Component({
  selector: 'app-cutting',
  imports: [FormsModule, RouterLink, ChainSteps],
  template: `
    <div class="head"><h2>Découpe</h2></div>
    <app-chain-steps current="decoupe" />
    <p class="hint">Quand vous coupez une bête, dites ce qui en sort. Les bêtes entières quittent le frigo, chaque coupe reçoit son poids dans son propre stock, et le reste part en os et déchets.</p>

    <form class="card-box" #f="ngForm" (ngSubmit)="save(f)">
      <div class="grid2">
        <label>Frigo
          <select name="reserve" required [(ngModel)]="draft.reserve" (ngModelChange)="pickReserve()">
            <option value="">Choisir…</option>
            @for (r of reserves(); track r.id) { <option [value]="r.id">{{ r.name }} · {{ r.whole ?? 0 }} bête(s) entière(s)</option> }
          </select>
        </label>
        @if (countries().length) {
          <label>Pays des bêtes
            <select name="origin" required [(ngModel)]="draft.origin" (ngModelChange)="suggestKg()">
              <option value="">Choisir…</option>
              @for (c of countries(); track c) { <option [value]="c">{{ c }} · {{ left(c) }} bête(s)</option> }
            </select>
          </label>
        }
        <label>Nombre de bêtes découpées
          <input name="beasts" type="number" min="0.5" step="0.5" required [(ngModel)]="draft.beasts" (ngModelChange)="suggestKg()">
          @if (reserve(); as r) { <small class="why">Il reste {{ left(draft.origin || undefined) }} bête(s) entière(s){{ draft.origin ? ' (' + draft.origin + ')' : '' }}. 0,5 = une demi-bête.</small> }
        </label>
        <label>Poids des bêtes découpées (kg)
          <input name="kg" type="number" min="0.1" step="0.1" required [(ngModel)]="draft.kg">
          @if (reserve()) { <small class="why">Proposé avec le poids moyen ({{ avg() }} kg par bête). Corrigez si vous avez pesé.</small> }
        </label>
      </div>

      @if (reserve(); as r) {
        <div class="pieces">
          <b>Ce qui sort de la découpe</b>
          @for (p of cuts(); track p.id) {
            <label class="piece">
              <span class="pic">@if (p.image) { <img [src]="p.image" alt=""> }</span>
              <span class="name">{{ p.name_fr }}</span>
              <span class="kg"><input type="number" min="0" step="0.1" [name]="'piece-' + p.id" placeholder="0" [attr.aria-label]="'Kilos de ' + p.name_fr" [(ngModel)]="draft.pieces[p.id]"> kg</span>
            </label>
          } @empty {
            <p class="why">Aucune coupe reliée à {{ r.name }}. Dans <a routerLink="/admin/produits">Produits</a>, choisissez « Stock : Réserve {{ r.name }} » et « Vendu comme : Coupe ».</p>
          }
          <div class="waste" [class.bad]="waste() < 0">
            <span>Os et déchets</span>
            <b>{{ waste() }} kg</b>
            @if (draft.kg && waste() >= 0) { <small>{{ wastePct() }} % du poids</small> }
            @if (waste() < 0) { <small>Les coupes pèsent plus que les bêtes : vérifiez les poids.</small> }
          </div>
          @if (!r.tracked) { <p class="msg">Le frigo {{ r.name }} n'est pas suivi : cochez « Suivre ce frigo » dans la page Frigo pour que les ventes retirent ces coupes.</p> }
        </div>
      }

      <div class="grid2">
        <label>Date<input name="date" type="date" required [(ngModel)]="draft.date"></label>
        <label>Note (facultatif)<input name="note" placeholder="Ex. commande de l'Aïd" [(ngModel)]="draft.note"></label>
      </div>
      @if (error()) { <div class="msg">{{ error() }}</div> }
      <div class="form-actions"><button class="btn" type="submit" [disabled]="f.invalid || busy() || waste() < 0 || !totalCuts()">{{ busy() ? 'Enregistrement…' : 'Enregistrer la découpe' }}</button></div>
    </form>

    <div class="head list-head"><h3>Découpes enregistrées</h3></div>
    <div class="items">
      @for (c of history(); track c.id) {
        <div class="item" [class.off]="c.cancelled">
          <div class="info">
            <b>{{ c.matricule }} · {{ c.reserve.name }} @if (c.cancelled) { <span class="pill alert">Annulée</span> }</b>
            <small>{{ c.beasts }} bête(s) · {{ c.kg }} kg{{ c.origin ? ' · ' + c.origin : '' }} · le {{ c.date }}</small>
            <small>{{ pieceText(c) }} · os {{ c.waste }} kg</small>
          </div>
          @if (!c.cancelled) { <button class="btn light small" (click)="cancel(c)" [disabled]="busy()">Annuler</button> }
        </div>
      } @empty {
        @if (loaded()) { <div class="empty">Aucune découpe enregistrée pour le moment.</div> }
      }
    </div>
  `,
  styles: `
    .hint { color: var(--muted); margin-bottom: 16px; }
    .card-box { max-width: 900px; margin-bottom: 24px; display: grid; gap: 14px; }
    .card-box .grid2 > label { align-content: start; }
    .why { color: var(--muted); font-size: .78rem; font-weight: 400; }
    .pieces { display: grid; gap: 6px; padding: 12px 14px; background: var(--bg); border-radius: 12px; }
    .piece { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 10px; align-items: center; margin: 0; padding: 6px 8px; background: #fff; border-radius: 10px; font-weight: 500; }
    .pic { width: 44px; height: 36px; overflow: hidden; border-radius: 7px; background: var(--bg); }
    .pic img { width: 100%; height: 100%; object-fit: cover; }
    .kg { display: flex; align-items: center; gap: 6px; color: var(--muted); }
    .kg input { width: 96px; }
    .waste { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; margin-top: 4px; padding: 8px 10px; border: 1px dashed var(--line); border-radius: 10px; }
    .waste b { font-size: 1.1rem; }
    .waste small { color: var(--muted); }
    .waste.bad { border-color: #a10c20; color: #a10c20; }
    .waste.bad small { color: #a10c20; }
    .list-head h3 { font-family: Inter, sans-serif; font-size: 1.05rem; }
    .info small { display: block; }
  `,
})
export class Cutting implements OnInit {
  private readonly data = inject(AdminData);
  private readonly route = inject(ActivatedRoute);
  protected readonly history = signal<CutRecord[]>([]);
  protected readonly loaded = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected draft = blank(this.route.snapshot.queryParamMap.get('frigo') ?? '');

  protected readonly reserves = computed(() => this.data.fridge().filter(f => !isCabinet(f)));

  async ngOnInit() {
    try {
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    }
    this.loaded.set(true);
    if (this.draft.reserve) this.pickReserve();
  }

  private async reload() {
    this.history.set((await this.data.listRegister()).cuts);
  }

  protected reserve(): FridgeItem | undefined {
    return this.reserves().find(r => r.id === this.draft.reserve);
  }

  protected countries() {
    const r = this.reserve();
    return r ? reserveCountries(r) : [];
  }

  protected cuts() {
    const r = this.reserve();
    return r ? cutsOf(r, this.data.products()) : [];
  }

  protected left(country?: string) {
    const r = this.reserve();
    return r ? wholeLeft(r, country && r.wholeBy ? country : undefined) : 0;
  }

  protected avg() {
    const r = this.reserve();
    return r ? beastWeight(r, this.draft.origin && r.wholeBy ? this.draft.origin : undefined) : 0;
  }

  protected pickReserve() {
    this.draft.origin = this.countries().length === 1 ? this.countries()[0] : '';
    this.draft.pieces = {};
    this.suggestKg();
  }

  protected suggestKg() {
    const n = Number(this.draft.beasts) || 0;
    this.draft.kg = n && this.avg() ? roundStock(n * this.avg()) : null;
  }

  private pieceList() {
    return this.cuts().map(p => ({ id: p.id, name: p.name_fr, kg: roundStock(Number(this.draft.pieces[p.id]) || 0) })).filter(c => c.kg > 0);
  }

  protected totalCuts() {
    return this.pieceList().length;
  }

  protected waste() {
    return cutWaste(Number(this.draft.kg) || 0, this.pieceList());
  }

  protected wastePct() {
    const kg = Number(this.draft.kg) || 0;
    return kg ? Math.round((Math.max(0, this.waste()) / kg) * 100) : 0;
  }

  protected pieceText(c: CutRecord) {
    return c.cuts.map(x => `${x.name} ${x.kg} kg`).join(' · ');
  }

  protected async save(form: NgForm) {
    const r = this.reserve();
    const beasts = Number(this.draft.beasts) || 0;
    const kg = Number(this.draft.kg) || 0;
    if (!r || !beasts || !kg) return;
    if (this.countries().length && !this.draft.origin) {
      this.error.set('Choisissez le pays des bêtes découpées.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const matricule = await this.data.addCut({
        reserve: { id: r.id, name: r.name }, beasts, kg, cuts: this.pieceList(), date: this.draft.date, note: this.draft.note.trim(),
        ...(this.draft.origin ? { origin: this.draft.origin } : {}),
      });
      this.data.notify(`Découpe enregistrée : ${matricule}`);
      const next = blank(r.id);
      this.draft = next;
      form.resetForm(next);
      this.pickReserve();
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async cancel(c: CutRecord) {
    if (!confirm(`Annuler ${c.matricule} ? ${c.beasts} bête(s) reviennent au frigo et les coupes sont retirées du stock.`)) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.data.cancelCut(c);
      this.data.notify(`${c.matricule} annulée`);
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
