import { Component, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FridgeItem, animals, roundStock } from '../core/data';
import { AdminData } from './admin-data';

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

@Component({
  selector: 'app-fridge',
  imports: [FormsModule],
  template: `
    <div class="head"><h2>Frigo : réserve en kg</h2></div>
    <p class="hint">
      Tout est compté en kilos. Un mouton vendu entier, en moitié ou découpé retire son poids de la même réserve
      à la confirmation de la commande.
    </p>
    <div class="stats">
      @for (f of list(); track f) {
        <div class="stat" [class.low]="low(f)" [class.off]="!f.tracked">
          <b>{{ round(f.kg) }} kg</b>
          <span>{{ f.name || 'Nouveau' }} · environ {{ beasts(f) }} {{ (f.name || '').toLowerCase() }}</span>
        </div>
      }
    </div>
    <form class="card-box" (ngSubmit)="save()">
      @for (f of list(); track f; let i = $index) {
        <fieldset>
          <div class="top">
            <input class="name" [name]="'name' + i" required placeholder="Moutons" aria-label="Nom" [(ngModel)]="f.name">
            <label class="check"><input type="checkbox" [name]="'on' + i" [(ngModel)]="f.tracked"> Suivre cette réserve</label>
            <button type="button" class="btn danger small" (click)="remove(i)">✕</button>
          </div>
          <div class="fields">
            <label>En stock (kg)<input [name]="'kg' + i" type="number" min="0" step="0.5" [(ngModel)]="f.kg"></label>
            <label>Minimum (kg)<input [name]="'min' + i" type="number" min="0" [(ngModel)]="f.min"></label>
            <label>Maximum (kg)<input [name]="'max' + i" type="number" min="0" [(ngModel)]="f.max"></label>
            <label>Poids moyen d'une bête (kg)<input [name]="'each' + i" type="number" min="0" step="0.1" [(ngModel)]="f.kgEach"></label>
            <label>Arrivage (kg)
              <span class="arrival">
                <input #arrival type="number" min="0" step="0.5" placeholder="+ kg" aria-label="Poids reçu">
                <button type="button" class="btn small" (click)="receive(f, arrival)">Ajouter</button>
              </span>
            </label>
            @if (f.kg <= 0) {
              <label>Retour prévu<input [name]="'back' + i" type="date" [(ngModel)]="f.restockDate"></label>
            }
          </div>
        </fieldset>
      }
      <div><button type="button" class="btn light small" (click)="add()">+ Ajouter une réserve</button></div>
      @if (error()) { <div class="msg">{{ error() }}</div> }
      <div><button class="btn" type="submit" [disabled]="saving()">{{ saving() ? 'Enregistrement…' : 'Enregistrer' }}</button></div>
    </form>
  `,
  styles: `
    .hint { color: var(--muted); margin-bottom: 16px; max-width: 760px; }
    .card-box { max-width: 900px; }
    fieldset { border: 0; padding-bottom: 14px; border-bottom: 1px dashed var(--line); }
    .top { display: flex; gap: 12px; align-items: center; margin-bottom: 10px; }
    .top .name { max-width: 240px; font-weight: 700; }
    .top .check { flex: 1; }
    .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; align-items: end; }
    .arrival { display: flex; gap: 6px; }
    .stat.low { border-color: var(--orange); background: #fdf1dc; }
    .stat.off { opacity: .55; }
  `,
})
export class Fridge {
  private readonly data = inject(AdminData);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly round = roundStock;
  /** Copie modifiable, renouvelée quand Firestore change */
  protected readonly list = linkedSignal(() => structuredClone(this.data.fridge()));

  protected beasts(f: FridgeItem) {
    return animals(f, Number(f.kg) || 0);
  }

  protected low(f: FridgeItem) {
    return f.tracked && (f.kg <= 0 || (!!f.min && f.kg <= f.min));
  }

  protected add() {
    this.list.update(l => [...l, { id: '', name: '', tracked: true, kg: 0, min: 0, max: 0, kgEach: 0 }]);
  }

  protected remove(i: number) {
    this.list.update(l => l.filter((_, n) => n !== i));
  }

  /** Un arrivage s'ajoute à la réserve et efface la date de retour annoncée. */
  protected receive(f: FridgeItem, input: HTMLInputElement) {
    const kg = Number(input.value);
    if (!(kg > 0)) return;
    f.kg = roundStock((Number(f.kg) || 0) + kg);
    delete f.restockDate;
    input.value = '';
  }

  protected async save() {
    const list = this.list().map(({ restockDate, ...f }) => ({
      ...f, id: f.id || slug(f.name), name: f.name.trim(), tracked: !!f.tracked,
      kg: Number(f.kg) || 0, min: Number(f.min) || 0, max: Number(f.max) || 0, kgEach: Number(f.kgEach) || 0,
      ...(restockDate ? { restockDate } : {}),
    }));
    this.saving.set(true);
    this.error.set('');
    try {
      await this.data.saveFridge(list);
      this.data.notify('Frigo enregistré');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
