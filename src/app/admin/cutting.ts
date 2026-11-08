import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FridgeItem, isCabinet, roundStock } from '../core/data';
import { localDay } from '../core/stats';
import { Carcass, carcassLabel, rebuildCarcasses, shareOf } from '../core/carcasses';
import { Lot } from '../core/lots';
import { CutRecord, cutWaste, cutsOf, reserveCountries } from '../core/stock-chain';
import { AdminData } from './admin-data';
import { ChainSteps } from './chain-steps';

const blank = (reserve = '') => ({
  reserve, origin: '', kg: null as number | null, date: localDay(new Date()), note: '',
  pieces: {} as Record<string, number | null>,
  /** Ce qui n'est pas coupé : à la poubelle (os) ou gardé au frigo */
  keep: true, rest: null as number | null,
});

@Component({
  selector: 'app-cutting',
  imports: [FormsModule, RouterLink, ChainSteps],
  template: `
    <div class="head"><h2>Découpe</h2></div>
    <app-chain-steps current="decoupe" />
    <p class="hint">Quand vous coupez une bête, dites ce qui en sort. Les bêtes entières quittent le frigo, chaque coupe reçoit son poids dans son propre stock, et le reste part en os et déchets.</p>

    <svg class="defs" aria-hidden="true"><defs><linearGradient id="cut-half" x1="0" x2="1"><stop offset=".5" stop-color="#f1d3c8" /><stop offset=".5" stop-color="#fff" /></linearGradient></defs></svg>
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
            <select name="origin" [(ngModel)]="draft.origin" (ngModelChange)="picked = []; suggestKg()">
              <option value="">Tous les pays</option>
              @for (c of countries(); track c) { <option [value]="c">{{ c }}</option> }
            </select>
          </label>
        }
      </div>

      @if (reserve(); as r) {
        <div class="hang">
          <div class="hang-head">
            <b>Choisissez les bêtes à découper</b>
            <small class="why">Cliquez sur une carcasse pour la choisir, cliquez encore pour l'enlever.</small>
          </div>
          <div class="picker">
            @for (g of groups(); track g.key; let i = $index) {
              @let c = g.first;
              <div class="pick-wrap">
              <button type="button" class="pick" [class.on]="pickedIn(g) > 0" [attr.aria-pressed]="pickedIn(g) > 0" (click)="g.items.length > 1 ? add(g) : toggle(c)">
                <svg viewBox="0 0 60 130" aria-hidden="true">
                  <path class="hook" d="M30 0V5M9 6H51M13 6v3c0 2.5-2.5 2.5-2.5.5M47 6v3c0 2.5 2.5 2.5 2.5.5" />
                  <path class="meat" [class.half]="c.half" d="M13 10C12 16 14 22 17 28C9 36 9 50 15 58C16 63 18 66 19 70C15 78 14 88 16 96C14 104 12 110 15 116C18 121 23 124 26 128H34C37 124 42 121 45 116C48 110 46 104 44 96C46 88 45 78 41 70C42 66 44 63 45 58C51 50 51 36 43 28C46 22 48 16 47 10L42 12C40 18 36 24 30 27C24 24 20 18 18 12Z" />
                </svg>
                <b>{{ c.kg }} kg{{ g.items.length > 1 ? ' chacun' : '' }}</b>
                <small>{{ g.items.length > 1 ? (c.lot || 'Lot') + ' · ' + g.items.length + ' bêtes' : label(c, i) }}</small>
                <small>{{ c.origin || '' }}{{ c.date ? ' · ' + c.date : '' }}{{ c.half ? ' · demi' : '' }}</small>
                <i class="check" aria-hidden="true">{{ g.items.length > 1 ? pickedIn(g) : '✓' }}</i>
              </button>
              @if (g.items.length > 1) {
                <div class="stepper">
                  <button type="button" [disabled]="!pickedIn(g)" [attr.aria-label]="'Une bête de moins'" (click)="remove(g)">−</button>
                  <input type="number" min="0" [max]="g.items.length" [attr.aria-label]="'Nombre de bêtes à découper'" [value]="pickedIn(g)" (change)="setCount(g, $any($event.target).value)">
                  <button type="button" [disabled]="pickedIn(g) >= g.items.length" [attr.aria-label]="'Une bête de plus'" (click)="add(g)">+</button>
                </div>
              }
              </div>
            } @empty {
              <p class="why">Aucune bête entière dans ce frigo{{ draft.origin ? ' pour ' + draft.origin : '' }}. Enregistrez d'abord un arrivage.</p>
            }
          </div>
          <div class="picked">
            <span><b>{{ beasts() }}</b> bête(s) choisie(s)</span>
            <label>Poids découpé (kg)
              <input name="kg" type="number" min="0.1" step="0.1" required [(ngModel)]="draft.kg">
            </label>
            <small class="why">Le poids se remplit avec celui des carcasses choisies. Corrigez si vous repesez.</small>
          </div>
        </div>
      }

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
          @if (draft.kg && totalCuts()) {
            <div class="left-over">
              <b>Il reste {{ leftOver() }} kg non découpés</b>
              <div class="choice" role="radiogroup" aria-label="Que devient le reste ?">
                <label [class.on]="draft.keep"><input type="radio" name="keep" [value]="true" [(ngModel)]="draft.keep" (ngModelChange)="draft.rest = null"> Je garde le reste au frigo pour la prochaine découpe</label>
                <label [class.on]="!draft.keep"><input type="radio" name="keep" [value]="false" [(ngModel)]="draft.keep"> Tout le reste, c'est des os et déchets</label>
              </div>
              @if (draft.keep) {
                <label class="os">Os et déchets jetés (kg)
                  <input name="os" type="number" min="0" step="0.1" placeholder="0" [(ngModel)]="draft.rest">
                </label>
                <small class="why">Gardé au frigo : <b>{{ kept() }} kg</b>. Il apparaîtra comme « reste » à choisir dans votre prochaine découpe.</small>
              }
            </div>
          }
          <div class="waste" [class.bad]="waste() < 0">
            <span>Os et déchets</span>
            <b>{{ waste() }} kg</b>
            @if (draft.kg && waste() >= 0) { <small>{{ wastePct() }} % du poids</small> }
            @if (kept()) { <span>· gardé au frigo <b>{{ kept() }} kg</b></span> }
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
      <div class="form-actions"><button class="btn" type="submit" [disabled]="f.invalid || busy() || waste() < 0 || !totalCuts() || !picked.length">{{ busy() ? 'Enregistrement…' : 'Enregistrer la découpe' }}</button></div>
    </form>

    <div class="head list-head"><h3>Découpes enregistrées</h3></div>
    <div class="items">
      @for (c of history(); track c.id) {
        <div class="item" [class.off]="c.cancelled">
          <div class="info">
            <b>{{ c.matricule }} · {{ c.reserve.name }} @if (c.cancelled) { <span class="pill alert">Annulée</span> }</b>
            <small>{{ c.beasts }} bête(s) · {{ c.kg }} kg{{ c.origin ? ' · ' + c.origin : '' }} · le {{ c.date }}</small>
            @if (c.carcasses?.length) { <small>Bêtes : {{ pickedText(c) }}</small> }
            <small>{{ pieceText(c) }} · {{ c.rest ? 'gardé au frigo ' + c.rest + ' kg · ' : '' }}{{ c.waste ? 'non découpé ' + c.waste + ' kg (compté en os)' : 'aucun os' }}</small>
          </div>
          @if (!c.cancelled) {
            <div class="row-actions">
              @if (c.waste > 0) { <button class="btn small" (click)="keep(c)" [disabled]="busy()" [title]="'Une partie des ' + c.waste + ' kg est encore de la viande à découper'">Garder le reste au frigo</button> }
              <button class="btn light small" (click)="cancel(c)" [disabled]="busy()">Annuler</button>
            </div>
          }
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
    .left-over { display: grid; gap: 8px; margin-top: 4px; padding: 10px 12px; background: #fff; border-radius: 10px; }
    .choice { display: flex; flex-wrap: wrap; gap: 8px; }
    .choice label { display: flex; align-items: center; gap: 6px; margin: 0; padding: 7px 12px; border: 1px solid var(--line); border-radius: 999px; font-weight: 500; cursor: pointer; }
    .choice label.on { border-color: #a10c20; background: #fbeef0; }
    .os { margin: 0; max-width: 220px; }
    .waste { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; margin-top: 4px; padding: 8px 10px; border: 1px dashed var(--line); border-radius: 10px; }
    .waste b { font-size: 1.1rem; }
    .waste small { color: var(--muted); }
    .waste.bad { border-color: #a10c20; color: #a10c20; }
    .waste.bad small { color: #a10c20; }
    .defs { position: absolute; width: 0; height: 0; overflow: hidden; }
    .hang { display: grid; gap: 10px; padding: 12px 14px; background: var(--bg); border-radius: 12px; }
    .hang-head { display: grid; gap: 2px; }
    .picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
    .pick { position: relative; display: grid; justify-items: center; gap: 2px; padding: 10px 6px 8px; background: #fff; border: 2px solid transparent; border-radius: 12px; font: inherit; cursor: pointer; box-shadow: 0 1px 0 var(--line); transition: border-color .15s, transform .15s; }
    .pick:hover { transform: translateY(-2px); }
    .pick.on { border-color: #a10c20; background: #fdf3f4; }
    .pick svg { width: 34px; height: 74px; margin-bottom: 4px; }
    .pick .hook { fill: none; stroke: #7d7872; stroke-width: 2.4; stroke-linecap: round; }
    .pick .meat { fill: #f1d3c8; stroke: #9d4a48; stroke-width: 1.4; }
    .pick .meat.half { fill: url(#cut-half); }
    .pick b { font-size: 1rem; }
    .pick-wrap { display: grid; gap: 4px; }
    .stepper { display: grid; grid-template-columns: 30px 1fr 30px; gap: 4px; }
    .stepper button { padding: 0; height: 30px; background: #fff; border: 1px solid var(--line); border-radius: 8px; font: inherit; font-weight: 700; cursor: pointer; }
    .stepper button:disabled { opacity: .35; cursor: default; }
    .stepper input { height: 30px; padding: 0 4px; text-align: center; }
    .pick .check { min-width: 20px; width: auto; padding: 0 5px; border-radius: 999px; }
    .pick small { color: var(--muted); font-size: .72rem; text-align: center; }
    .pick .check { position: absolute; top: 6px; inset-inline-end: 6px; display: none; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: #a10c20; color: #fff; font-style: normal; font-size: .75rem; }
    .pick.on .check { display: grid; }
    .picked { display: flex; flex-wrap: wrap; align-items: end; gap: 6px 16px; }
    .picked label { margin: 0; }
    .picked input { width: 120px; }
    .row-actions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
    .list-head h3 { font-family: Inter, sans-serif; font-size: 1.05rem; }
    .info small { display: block; }
  `,
})
export class Cutting implements OnInit {
  private readonly data = inject(AdminData);
  private readonly route = inject(ActivatedRoute);
  protected readonly history = signal<CutRecord[]>([]);
  protected readonly lots = signal<Lot[]>([]);
  protected readonly label = carcassLabel;
  protected picked: Carcass[] = [];
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
    const { cuts, lots } = await this.data.listRegister();
    this.history.set(cuts);
    this.lots.set(lots);
  }

  /** Carcasses du frigo (retrouvées dans les arrivages si besoin), filtrées par pays */
  private all(): Carcass[] {
    const r = this.reserve();
    return r ? rebuildCarcasses(r, this.lots()) : [];
  }

  protected hanging() {
    const o = this.draft.origin;
    return this.all().filter(c => !o || !c.origin || c.origin === o);
  }

  /** Carcasses identiques d'un même lot (poulets) : une seule carte avec un compteur */
  protected groups() {
    const map = new Map<string, { key: string; first: Carcass; items: Carcass[] }>();
    for (const c of this.hanging()) {
      const key = c.n !== undefined || c.part ? c.id : `${c.lot ?? ''}|${c.kg}|${c.origin ?? ''}|${c.half ? 1 : 0}`;
      const g = map.get(key);
      if (g) g.items.push(c); else map.set(key, { key, first: c, items: [c] });
    }
    return [...map.values()];
  }

  protected pickedIn(g: { items: Carcass[] }) {
    return g.items.filter(c => this.isPicked(c)).length;
  }

  protected add(g: { items: Carcass[] }) {
    const next = g.items.find(c => !this.isPicked(c));
    if (next) { this.picked = [...this.picked, next]; this.suggestKg(); }
  }

  protected remove(g: { items: Carcass[] }) {
    const last = [...g.items].reverse().find(c => this.isPicked(c));
    if (last) { this.picked = this.picked.filter(x => x.id !== last.id); this.suggestKg(); }
  }

  protected setCount(g: { items: Carcass[] }, value: string) {
    const n = Math.min(g.items.length, Math.max(0, Math.floor(Number(value) || 0)));
    const others = this.picked.filter(x => !g.items.some(c => c.id === x.id));
    this.picked = [...others, ...g.items.slice(0, n)];
    this.suggestKg();
  }

  protected isPicked(c: Carcass) {
    return this.picked.some(x => x.id === c.id);
  }

  protected toggle(c: Carcass) {
    this.picked = this.isPicked(c) ? this.picked.filter(x => x.id !== c.id) : [...this.picked, c];
    this.suggestKg();
  }

  protected beasts() {
    return roundStock(this.picked.reduce((sum, c) => sum + shareOf(c), 0));
  }

  protected pickedText(c: CutRecord) {
    return (c.carcasses ?? []).map((x, i) => `${carcassLabel(x, i)} (${x.kg} kg)`).join(' · ');
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

  protected pickReserve() {
    this.draft.origin = this.countries().length === 1 ? this.countries()[0] : '';
    this.draft.pieces = {};
    this.picked = [];
    this.suggestKg();
  }

  protected suggestKg() {
    const kg = roundStock(this.picked.reduce((sum, c) => sum + c.kg, 0));
    this.draft.kg = kg || null;
  }

  private pieceList() {
    return this.cuts().map(p => ({ id: p.id, name: p.name_fr, kg: roundStock(Number(this.draft.pieces[p.id]) || 0) })).filter(c => c.kg > 0);
  }

  protected totalCuts() {
    return this.pieceList().length;
  }

  /** Poids pas encore découpé : les carcasses moins les coupes */
  protected leftOver() {
    return Math.max(0, cutWaste(Number(this.draft.kg) || 0, this.pieceList()));
  }

  /** Ce qu'on garde au frigo : le reste moins les os déclarés */
  protected kept() {
    if (!this.draft.keep) return 0;
    return Math.max(0, roundStock(this.leftOver() - (Number(this.draft.rest) || 0)));
  }

  protected waste() {
    return cutWaste(Number(this.draft.kg) || 0, this.pieceList(), this.kept());
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
    const beasts = this.beasts();
    const kg = Number(this.draft.kg) || 0;
    if (!r || !this.picked.length || !kg) return;
    const origins = [...new Set(this.picked.map(c => c.origin).filter(Boolean))] as string[];
    if (origins.length > 1) {
      this.error.set('Choisissez des bêtes d\'un seul pays par découpe : chaque coupe garde le pays de sa viande.');
      return;
    }
    const origin = origins[0] || this.draft.origin;
    this.busy.set(true);
    this.error.set('');
    try {
      const matricule = await this.data.addCut({
        reserve: { id: r.id, name: r.name }, beasts, kg, cuts: this.pieceList(), date: this.draft.date, note: this.draft.note.trim(),
        carcasses: this.picked, ...(r.carcasses ? {} : { base: this.all() }), ...(origin ? { origin } : {}), ...(this.kept() ? { rest: this.kept() } : {}),
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

  /** Les « os » comptaient encore de la viande : ces kilos redeviennent un reste à découper. */
  protected async keep(c: CutRecord) {
    const answer = prompt(`Sur les ${c.waste} kg non découpés, combien de kilos de viande gardez-vous au frigo pour la prochaine découpe ?`, String(c.waste));
    if (answer === null) return;
    const kg = roundStock(Number(answer.replace(',', '.')) || 0);
    if (kg <= 0 || kg > c.waste) {
      this.error.set(`Indiquez un nombre entre 0 et ${c.waste} kg.`);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.data.keepWaste(c, kg);
      this.data.notify(`${kg} kg gardés au frigo : choisissez « reste » dans la prochaine découpe`);
      await this.reload();
      this.picked = [];
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
