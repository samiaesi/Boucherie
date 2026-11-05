import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FridgeItem, poolOf, roundStock } from '../core/data';
import { AdminData } from './admin-data';
import { STATE_ICONS, STATE_LABELS, StockState, fridgeLine } from './stock-lines';

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const blank = (): FridgeItem => ({ id: '', name: '', tracked: true, kg: 0, min: 0, max: 0, kgEach: 0 });

@Component({
  selector: 'app-fridge',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="head">
      <h2>Frigo</h2>
      <div class="tools">
        <button class="btn light small" (click)="open(null)">+ Ajouter une réserve</button>
        <a class="btn small" routerLink="/admin/arrivages">Nouvel arrivage</a>
      </div>
    </div>
    <p class="hint">Un mouton vendu entier, en moitié ou en coupes retire son poids de la même réserve.</p>

    @if (error()) { <div class="msg">{{ error() }}</div> }

    <div class="cards">
      @for (l of lines(); track l.item.id) {
        <article class="card" [class.off]="!l.item.tracked">
          <header>
            <h3>{{ l.item.name }}</h3>
            <span class="state" [class]="'state ' + l.state">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="icon(l.state)" /></svg>{{ label(l.state) }}
            </span>
          </header>
          <div class="amount">
            <b>{{ round(l.item.kg) }} <small>kg</small></b>
            @if (l.item.kgEach) { <span>environ {{ l.beasts }} {{ l.item.name.toLowerCase() }}</span> }
          </div>
          @if (l.fill !== null) { <span class="gauge"><i [class]="l.state" [style.width.%]="l.fill"></i></span> }
          <dl>
            <div><dt>Minimum</dt><dd>{{ l.item.min ? l.item.min + ' kg' : '—' }}</dd></div>
            <div><dt>Maximum</dt><dd>{{ l.item.max ? l.item.max + ' kg' : '—' }}</dd></div>
            <div><dt>Poids d'une bête</dt><dd>{{ l.item.kgEach ? l.item.kgEach + ' kg' : '—' }}</dd></div>
            <div><dt>Coupes reliées</dt><dd>{{ linked(l.item) }}</dd></div>
          </dl>
          <footer>
            <button class="btn light small" (click)="open(l.item)">Modifier</button>
            <button class="btn small" [class.light]="l.item.tracked" (click)="toggle(l.item)" [disabled]="saving()">
              {{ l.item.tracked ? 'Ne plus suivre' : 'Suivre cette réserve' }}
            </button>
          </footer>
        </article>
      } @empty {
        <div class="empty">Aucune réserve. Ajoutez-en une pour suivre vos bêtes en kilos.</div>
      }
    </div>

    <dialog #dialog>
      @if (draft(); as d) {
        <form class="modal" (ngSubmit)="save(dialog)">
          <h3>{{ d.id ? 'Modifier ' + d.name : 'Nouvelle réserve' }}</h3>
          <div class="grid2">
            <label class="wide">Nom<input name="name" required placeholder="Moutons" [(ngModel)]="d.name"></label>
            <label>En stock (kg)<input name="kg" type="number" min="0" step="0.5" [(ngModel)]="d.kg"></label>
            <label>Poids moyen d'une bête (kg)<input name="each" type="number" min="0" step="0.1" [(ngModel)]="d.kgEach"></label>
            <label>Minimum (kg)<input name="min" type="number" min="0" [(ngModel)]="d.min"></label>
            <label>Maximum (kg)<input name="max" type="number" min="0" [(ngModel)]="d.max"></label>
            @if (!(d.kg > 0)) { <label class="wide">Retour prévu<input name="back" type="date" [(ngModel)]="d.restockDate"></label> }
          </div>
          <label class="check"><input name="tracked" type="checkbox" [(ngModel)]="d.tracked"> Suivre cette réserve</label>
          @if (error()) { <div class="msg">{{ error() }}</div> }
          <div class="modal-actions">
            @if (d.id) { <button type="button" class="btn danger" (click)="remove(d, dialog)">Supprimer</button> }
            <span></span>
            <button type="button" class="btn light" (click)="dialog.close()">Annuler</button>
            <button class="btn" type="submit" [disabled]="saving()">{{ saving() ? 'Enregistrement…' : 'Enregistrer' }}</button>
          </div>
        </form>
      }
    </dialog>
  `,
  styles: `
    .tools { display: flex; gap: 8px; }
    .hint { margin-bottom: 16px; color: var(--muted); }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px; }
    .card { display: grid; gap: 12px; padding: 18px; background: #fff; border: 1px solid var(--line); border-radius: 14px; }
    .card.off .amount b, .card.off h3 { color: var(--muted); }
    header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    h3 { font-family: Inter, sans-serif; font-size: 1.1rem; }
    .amount { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
    .amount b { font-size: 1.9rem; line-height: 1; }
    .amount small { font-size: 1rem; font-weight: 600; }
    .amount span { color: var(--muted); font-size: .85rem; }
    .gauge { margin: 0; }
    dl { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0; padding-top: 12px; border-top: 1px solid var(--line); }
    dt { color: var(--muted); font-size: .76rem; }
    dd { margin: 0; font-size: .92rem; font-weight: 600; }
    footer { display: flex; gap: 8px; flex-wrap: wrap; }
    dialog { width: min(560px, calc(100vw - 32px)); }
    .wide { grid-column: 1 / -1; }
    .modal-actions span { flex: 1; }
  `,
})
export class Fridge {
  private readonly data = inject(AdminData);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly draft = signal<FridgeItem | null>(null);
  protected readonly round = roundStock;
  protected readonly label = (s: StockState) => STATE_LABELS[s];
  protected readonly icon = (s: StockState) => STATE_ICONS[s];
  protected readonly lines = computed(() => this.data.fridge().map(fridgeLine));

  /** Coupes vendues depuis cette réserve quand elle est suivie */
  protected linked(f: FridgeItem) {
    const reserve = [{ ...f, tracked: true }];
    return this.data.products().filter(p => poolOf(p, reserve)).length;
  }

  protected open(f: FridgeItem | null) {
    this.error.set('');
    this.draft.set(structuredClone(f ?? blank()));
    (document.querySelector('app-fridge dialog') as HTMLDialogElement).showModal();
  }

  private async write(list: FridgeItem[]) {
    this.saving.set(true);
    this.error.set('');
    try {
      await this.data.saveFridge(list);
      this.data.notify('Frigo enregistré');
      return true;
    } catch (e) {
      this.error.set((e as Error).message);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  protected toggle(f: FridgeItem) {
    return this.write(this.data.fridge().map(x => (x.id === f.id ? { ...x, tracked: !x.tracked } : x)));
  }

  protected async save(dialog: HTMLDialogElement) {
    const d = this.draft();
    if (!d) return;
    const { restockDate, ...rest } = d;
    const kg = Number(d.kg) || 0;
    const item: FridgeItem = {
      ...rest, id: d.id || slug(d.name), name: d.name.trim(), tracked: !!d.tracked, kg,
      min: Number(d.min) || 0, max: Number(d.max) || 0, kgEach: Number(d.kgEach) || 0,
      ...(restockDate && kg <= 0 ? { restockDate } : {}),
    };
    const list = this.data.fridge();
    const next = d.id ? list.map(x => (x.id === d.id ? item : x)) : [...list, item];
    if (await this.write(next)) dialog.close();
  }

  protected async remove(d: FridgeItem, dialog: HTMLDialogElement) {
    const count = this.linked(d);
    const warning = count ? `\n\n${count} coupe(s) ne seront plus reliées à cette réserve.` : '';
    if (!confirm(`Supprimer la réserve « ${d.name} » ?${warning}`)) return;
    if (await this.write(this.data.fridge().filter(x => x.id !== d.id))) dialog.close();
  }
}
