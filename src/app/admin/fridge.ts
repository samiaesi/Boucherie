import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { COUNTRIES, Category, FridgeItem, ICON_NAMES, isCabinet, roundStock, sumCountries } from '../core/data';
import { IconPipe } from '../core/icon';
import { AdminData } from './admin-data';
import { ChainSteps } from './chain-steps';
import { STATE_ICONS, STATE_LABELS, StockState, fridgeContents, fridgeIcon, fridgeLine } from './stock-lines';

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type Draft = FridgeItem & { cabinet: boolean; iconName: string; picked: string[]; countryRows: { country: string; kg: number }[] };

const blank = (): Draft => ({
  id: '', name: '', tracked: true, kg: 0, min: 0, max: 0, kgEach: 0, cabinet: false, iconName: 'boeuf', picked: [], countryRows: [],
});

const PRESETS = [
  { name: 'Poissons surgelés', iconName: 'poisson', rayon: 'poissons' },
  { name: 'Légumes surgelés', iconName: 'legumes', rayon: 'legumes' },
];

@Component({
  selector: 'app-fridge',
  imports: [FormsModule, RouterLink, IconPipe, ChainSteps],
  template: `
    <div class="head">
      <h2>Frigo</h2>
      <div class="tools">
        <button class="btn light small" (click)="open(null)">+ Ajouter un frigo</button>
        <a class="btn small" routerLink="/admin/arrivages">Nouvel arrivage</a>
      </div>
    </div>
    <app-chain-steps current="frigo" />
    <p class="hint">Cliquez sur la porte d'un frigo pour voir ce qu'il contient.</p>

    @if (error()) { <div class="msg">{{ error() }}</div> }

    <div class="room">
      @for (l of lines(); track l.item.id) {
        <article class="unit" [class.is-open]="opened() === l.item.id">
          <div class="fridge" [class.frozen]="l.cabinet">
            <div class="inside">
              <div class="inside-head">
                <b>{{ l.item.name }}</b>
                <button class="btn light small" (click)="opened.set('')">Fermer</button>
              </div>
              <ul class="shelves">
                @for (c of contents(l.item); track c.product.id) {
                  <li><a routerLink="/admin/produits" [queryParams]="{ edit: c.product.id }" [attr.aria-label]="'Modifier ' + c.product.name_fr">
                    <span class="thumb">
                      @if (c.product.image) { <img [src]="c.product.image" alt=""> }
                      @else { <span [innerHTML]="iconOf(l.item) | icon"></span> }
                    </span>
                    <span class="what"><b>{{ c.product.name_fr }}</b>@if (c.note) { <small>{{ c.note }}</small> }</span>
                    @if (c.state) { <i class="dot" [class]="'dot ' + c.state" [title]="label(c.state)"></i> }
                  </a></li>
                } @empty {
                  <li class="none">Ce frigo est vide.</li>
                }
              </ul>
            </div>
            <button class="door" [attr.aria-expanded]="opened() === l.item.id" [attr.aria-label]="'Ouvrir le frigo ' + l.item.name" (click)="toggleDoor(l.item.id)">
              <i class="led" [class]="'led ' + l.state"></i>
              <span class="picto" [innerHTML]="iconOf(l.item) | icon"></span>
              <span class="plate"><b>{{ l.item.name }}</b><small>{{ amount(l) }}</small>
                @if (breakdown(l.item); as parts) { <small>{{ parts }}</small> }
              </span>
              <span class="state" [class]="'state ' + l.state">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="icon(l.state)" /></svg>{{ label(l.state) }}
              </span>
              @if (l.fill !== null) { <span class="gauge"><i [class]="l.state" [style.width.%]="l.fill"></i></span> }
              <i class="handle"></i>
            </button>
          </div>
          <footer>
            <button class="btn light small" (click)="open(l.item)">Modifier</button>
            @if (!l.cabinet) {
              <button class="btn small" [class.light]="l.item.tracked" (click)="toggle(l.item)" [disabled]="saving()">
                {{ l.item.tracked ? 'Ne plus suivre' : 'Suivre' }}
              </button>
            }
          </footer>
        </article>
      } @empty {
        <div class="empty">Aucun frigo. Ajoutez-en un pour suivre votre stock.</div>
      }
    </div>

    <dialog #dialog>
      @if (draft(); as d) {
        <form class="modal" (ngSubmit)="save(dialog)">
          <h3>{{ d.id ? 'Modifier ' + d.name : 'Nouveau frigo' }}</h3>
          @if (!d.id) {
            <div class="presets">
              @for (p of presets; track p.rayon) { <button type="button" class="btn light small" (click)="applyPreset(d, p)">{{ p.name }}</button> }
            </div>
          }
          <div class="grid2">
            <label>Nom<input name="name" required placeholder="Frigo moutons" [(ngModel)]="d.name"></label>
            <label>Pictogramme
              <select name="iconName" [(ngModel)]="d.iconName">
                @for (n of iconNames; track n[0]) { <option [value]="n[0]">{{ n[1] }}</option> }
              </select>
            </label>
            <label class="wide">Ce frigo contient
              <select name="kind" [ngModel]="d.cabinet" (ngModelChange)="d.cabinet = $event">
                <option [ngValue]="false">Une réserve en kilos (mouton, bœuf, poulet…)</option>
                <option [ngValue]="true">Des produits avec leur propre stock (surgelés…)</option>
              </select>
            </label>
            @if (d.cabinet) {
              <fieldset class="wide">
                <legend>Rayons rangés dans ce frigo</legend>
                @for (c of categories(); track c.id) {
                  <label class="check"><input type="checkbox" [name]="'r' + c.id" [checked]="d.picked.includes(c.id)" (change)="pick(d, c.id, $any($event.target).checked)"> {{ c.name_fr }}</label>
                }
              </fieldset>
            } @else {
              <label>En stock (kg)<input name="kg" type="number" min="0" step="0.5" [disabled]="d.countryRows.length > 0" [ngModel]="d.countryRows.length ? rowsTotal(d) : d.kg" (ngModelChange)="d.kg = $event"></label>
              <label>Poids moyen d'une bête (kg)<input name="each" type="number" min="0" step="0.1" [(ngModel)]="d.kgEach"></label>
              <label>Minimum (kg)<input name="min" type="number" min="0" [(ngModel)]="d.min"></label>
              <label>Maximum (kg)<input name="max" type="number" min="0" [(ngModel)]="d.max"></label>
              @if (!(d.kg > 0)) { <label class="wide">Retour prévu<input name="back" type="date" [(ngModel)]="d.restockDate"></label> }
              <div class="wide rows">
                <b>Stock par pays</b>
                <small>Chaque pays a son stock : une vente Espagne ne retire jamais le stock Algérie.</small>
                <datalist id="fridge-countries">@for (c of countries; track c.fr) { <option [value]="c.fr"></option> }</datalist>
                @for (r of d.countryRows; track r; let i = $index) {
                  <div class="row">
                    <input [name]="'country' + i" list="fridge-countries" autocomplete="off" required placeholder="Algérie" aria-label="Pays" [(ngModel)]="r.country">
                    <input [name]="'countryKg' + i" type="number" min="0" step="0.5" aria-label="Kilos" [(ngModel)]="r.kg">
                    <button type="button" class="btn danger small" aria-label="Retirer ce pays" (click)="d.countryRows.splice(i, 1)">✕</button>
                  </div>
                }
                <div><button type="button" class="btn add-row" (click)="d.countryRows.push({ country: '', kg: 0 })">+ Ajouter un pays</button></div>
              </div>
            }
          </div>
          @if (!d.cabinet) { <label class="check"><input name="tracked" type="checkbox" [(ngModel)]="d.tracked"> Suivre ce frigo</label> }
          @if (error()) { <div class="msg">{{ error() }}</div> }
          <div class="modal-actions">
            @if (d.id) { <button type="button" class="btn danger" (click)="remove(d, dialog)">Supprimer</button> }
            <span class="grow"></span>
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
    .room { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 26px; padding: 8px 4px; }
    .unit { position: relative; display: grid; gap: 10px; }
    .unit.is-open { z-index: 2; }
    .fridge { position: relative; height: 430px; border-radius: 18px; background: #2a2523; box-shadow: 0 14px 26px -18px rgba(0, 0, 0, .6); perspective: 1400px; }
    .fridge::after { content: ""; position: absolute; inset-inline: 22px; bottom: -8px; height: 8px; border-radius: 0 0 6px 6px; background: #1d1613; }
    .inside { position: absolute; inset: 6px; display: flex; flex-direction: column; overflow: hidden; border-radius: 13px; background: linear-gradient(90deg, #dfeaf1, #f6fbfd 12%, #f6fbfd 88%, #dfeaf1); box-shadow: inset 0 0 26px rgba(120, 170, 200, .35); }
    .inside::before { content: ""; flex: none; height: 7px; background: #fff; box-shadow: 0 2px 14px 5px rgba(255, 255, 255, .95); }
    .inside-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; }
    .shelves { flex: 1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; margin: 0; padding: 0; overflow-y: auto; overflow-x: hidden; list-style: none; }
    .shelves li { position: relative; min-width: 0; border-bottom: 5px solid #bcd6e4; box-shadow: 0 7px 7px -6px rgba(70, 110, 135, .4); }
    .shelves a { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; height: 100%; min-height: 124px; padding: 10px 10px 13px; color: inherit; text-align: center; border-radius: 10px; transition: background .2s, transform .2s; }
    .shelves a:hover { background: rgba(255, 255, 255, .85); transform: translateY(-3px); }
    .shelves a:focus-visible { outline: 2px solid var(--red); outline-offset: -3px; }
    .shelves li:nth-child(odd):last-child { grid-column: 1 / -1; }
    .shelves .none { grid-column: 1 / -1; padding: 30px 12px; color: var(--muted); text-align: center; }
    .thumb { flex: none; display: grid; place-items: center; width: 62px; height: 52px; overflow: hidden; border-radius: 9px; background: #fff; box-shadow: 0 5px 7px -5px rgba(0, 0, 0, .55); }
    .thumb img, .thumb span, .thumb :is(svg) { display: block; width: 100%; height: 100%; object-fit: cover; }
    .what { width: 100%; min-width: 0; }
    .what b { display: block; font-size: .76rem; line-height: 1.2; overflow-wrap: anywhere; }
    .what small { display: block; color: var(--muted); font-size: .72rem; }
    .dot { position: absolute; top: 9px; inset-inline-end: 9px; width: 10px; height: 10px; border-radius: 50%; background: var(--green); }
    .dot.low { background: var(--orange); }
    .dot.out { background: var(--red); }
    .dot.over { background: var(--blue); }
    .dot.untracked { background: #c9c3bb; }
    .door { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px 40px 24px 22px; border: 0; border-radius: 18px; background: linear-gradient(135deg, #fbfaf8, #e6e2dc 60%, #d6d1ca); color: var(--ink); font: inherit; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .06); transform-origin: 0 50%; transition: transform .75s cubic-bezier(.3, .8, .25, 1); }
    .frozen .door { background: linear-gradient(135deg, #f4fafe, #d9e9f3 60%, #c3d9e7); }
    .door:hover { transform: rotateY(-5deg); }
    .is-open .door { transform: rotateY(-108deg); pointer-events: none; }
    .led { position: absolute; top: 14px; inset-inline-start: 16px; width: 10px; height: 10px; border-radius: 50%; background: var(--green); box-shadow: 0 0 8px var(--green); }
    .led.low { background: var(--orange); box-shadow: 0 0 8px var(--orange); }
    .led.out { background: var(--red); box-shadow: 0 0 8px var(--red); }
    .led.over { background: var(--blue); box-shadow: 0 0 8px var(--blue); }
    .led.untracked { background: #bdb7af; box-shadow: none; }
    .picto { display: grid; place-items: center; width: 118px; height: 118px; padding: 12px; border-radius: 50%; background: #fff; box-shadow: 0 8px 18px -12px rgba(0, 0, 0, .5); }
    .picto :is(svg) { display: block; width: 100%; height: 100%; }
    .plate { text-align: center; }
    .plate b { display: block; font-size: 1.1rem; }
    .plate small { color: var(--muted); font-size: .86rem; }
    .door .gauge { width: 70%; margin: 0; }
    .handle { position: absolute; top: 50%; inset-inline-end: 13px; width: 8px; height: 104px; margin-top: -52px; border-radius: 6px; background: linear-gradient(90deg, #8e8880, #c6c0b8); }
    footer { display: flex; gap: 8px; justify-content: center; margin-top: 8px; }
    dialog { width: min(560px, calc(100vw - 32px)); }
    .presets { display: flex; gap: 8px; flex-wrap: wrap; }
    .wide { grid-column: 1 / -1; }
    fieldset { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 10px; border: 1px solid var(--line); border-radius: 10px; }
    legend { padding: 0 6px; color: var(--muted); font-size: .85rem; font-weight: 600; }
    .grow { flex: 1; }
    .rows { display: grid; gap: 8px; }
    .rows small { color: var(--muted); }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) 110px auto; gap: 8px; }
  `,
})
export class Fridge implements OnInit {
  private readonly data = inject(AdminData);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly draft = signal<Draft | null>(null);
  protected readonly opened = signal('');
  protected readonly categories = signal<Category[]>([]);
  protected readonly presets = PRESETS;
  protected readonly countries = COUNTRIES;
  protected readonly iconNames = Object.entries(ICON_NAMES);
  protected readonly iconOf = fridgeIcon;
  protected readonly label = (s: StockState) => STATE_LABELS[s];
  protected readonly icon = (s: StockState) => STATE_ICONS[s];
  protected readonly lines = computed(() => this.data.fridge().map(f => fridgeLine(f, this.data.products())));

  async ngOnInit() {
    this.categories.set(await this.data.getCategories());
  }

  protected contents(f: FridgeItem) {
    return fridgeContents(f, this.data.products());
  }

  protected amount(l: ReturnType<typeof fridgeLine>) {
    if (l.cabinet) return `${this.contents(l.item).length} produit(s) · ${roundStock(l.total)} kg`;
    return l.item.kgEach ? `${roundStock(l.item.kg)} kg · environ ${l.beasts}` : `${roundStock(l.item.kg)} kg`;
  }

  /** « Algérie 33 kg · Espagne 0 kg » */
  protected breakdown(f: FridgeItem) {
    return Object.entries(f.countries ?? {}).map(([country, kg]) => `${country} ${roundStock(kg)} kg`).join(' · ');
  }

  protected rowsTotal(d: Draft) {
    return sumCountries(Object.fromEntries(d.countryRows.map((r, i) => [String(i), Number(r.kg) || 0])));
  }

  protected toggleDoor(id: string) {
    this.opened.update(current => (current === id ? '' : id));
  }

  protected open(f: FridgeItem | null) {
    this.error.set('');
    this.draft.set(f
      ? {
        ...structuredClone(f), cabinet: isCabinet(f), iconName: fridgeIcon(f), picked: [...(f.rayons ?? [])],
        countryRows: Object.entries(f.countries ?? {}).map(([country, kg]) => ({ country, kg })),
      }
      : blank());
    (document.querySelector('app-fridge dialog') as HTMLDialogElement).showModal();
  }

  protected applyPreset(d: Draft, p: (typeof PRESETS)[number]) {
    d.name = p.name;
    d.iconName = p.iconName;
    d.cabinet = true;
    d.picked = [p.rayon];
  }

  protected pick(d: Draft, id: string, on: boolean) {
    d.picked = on ? [...d.picked, id] : d.picked.filter(x => x !== id);
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
    if (d.cabinet && !d.picked.length) {
      this.error.set('Choisissez au moins un rayon pour ce frigo.');
      return;
    }
    const { restockDate, rayons, cabinet, iconName, picked, countryRows, countries, ...rest } = d;
    const split = cabinet ? [] : countryRows.filter(r => r.country.trim());
    const perCountry = Object.fromEntries(split.map(r => [r.country.trim(), Number(r.kg) || 0]));
    const kg = cabinet ? 0 : split.length ? sumCountries(perCountry) : Number(d.kg) || 0;
    const item: FridgeItem = {
      ...rest, id: d.id || slug(d.name), name: d.name.trim(), tracked: !cabinet && !!d.tracked, kg, icon: iconName,
      min: cabinet ? 0 : Number(d.min) || 0, max: cabinet ? 0 : Number(d.max) || 0, kgEach: cabinet ? 0 : Number(d.kgEach) || 0,
      ...(cabinet ? { rayons: picked } : {}),
      ...(split.length ? { countries: perCountry } : {}),
      ...(!cabinet && restockDate && kg <= 0 ? { restockDate } : {}),
    };
    const list = this.data.fridge();
    const next = d.id ? list.map(x => (x.id === d.id ? item : x)) : [...list, item];
    if (await this.write(next)) dialog.close();
  }

  protected async remove(d: Draft, dialog: HTMLDialogElement) {
    const count = this.contents(d).length;
    const warning = !d.cabinet && count ? `\n\n${count} coupe(s) ne seront plus reliées à ce frigo.` : '';
    if (!confirm(`Supprimer le frigo « ${d.name} » ?${warning}`)) return;
    if (await this.write(this.data.fridge().filter(x => x.id !== d.id))) dialog.close();
  }
}
