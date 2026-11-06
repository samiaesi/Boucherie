import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Product, formatNumber } from '../core/data';
import { Dish, MENU_STYLES, MenuRecipe, MenuStyle, planMenus } from '../core/menu-planner';
import { AdminData } from './admin-data';

const PREVIEW_GUESTS = 6;
const DEFAULT_GRAMS = 200;
const DEFAULT_SERVES = 4;

const blankDish = (): Dish => ({ product: '', gramsEach: DEFAULT_GRAMS, serves: DEFAULT_SERVES });
const blankMenu = (): MenuRecipe => ({ id: '', style: 'fete', name_fr: '', name_ar: '', dishes: [blankDish()] });

@Component({
  selector: 'app-menus',
  imports: [FormsModule],
  template: `
    <div class="head">
      <h2>Menus proposés</h2>
      <div class="chips"><button class="btn" (click)="open(null)">+ Créer un menu</button></div>
    </div>
    <div class="finder">
      <input type="search" placeholder="Nom du menu…" aria-label="Rechercher un menu" [ngModel]="search()" (ngModelChange)="search.set($event)" name="search">
      <select aria-label="Style" [ngModel]="style()" (ngModelChange)="style.set($event)" name="style">
        <option value="">Tous les styles</option>
        @for (s of styles; track s.id) { <option [value]="s.id">{{ s.label }}</option> }
      </select>
      <span>{{ shown().length }} / {{ menus().length }}</span>
    </div>
    <div class="items">
      @for (m of shown(); track m.id) {
        <div class="item" [class.off]="m.hidden">
          <div class="info">
            <b>{{ m.name_fr }} <span class="ar">· {{ m.name_ar }}</span>
              @if (m.hidden) { <span class="pill">Masqué</span> }</b>
            <small>{{ styleName(m.style) }} · {{ dishNames(m) }}</small>
          </div>
          <div class="price">{{ preview(m) }}</div>
          <div class="item-actions">
            <button class="btn light small" (click)="toggle(m)">{{ m.hidden ? 'Afficher' : 'Masquer' }}</button>
            <button class="btn light small" (click)="open(m)">Modifier</button>
            <button class="btn danger small" [attr.aria-label]="'Supprimer ' + m.name_fr" (click)="remove(m)">✕</button>
          </div>
        </div>
      } @empty {
        @if (loaded()) { <div class="empty">Aucun menu trouvé.</div> }
      }
    </div>

    <dialog #dialog>
      <form class="modal" (ngSubmit)="save()">
        <h3>{{ editingId ? 'Modifier le menu' : 'Nouveau menu' }}</h3>
        <div class="grid2">
          <label>Nom (français)<input name="name_fr" required [(ngModel)]="draft.name_fr"></label>
          <label>Nom (arabe)<input name="name_ar" dir="rtl" required [(ngModel)]="draft.name_ar"></label>
          <label>Style
            <select name="menuStyle" [(ngModel)]="draft.style">
              @for (s of styles; track s.id) { <option [value]="s.id">{{ s.label }}</option> }
            </select>
          </label>
          <label>À partir de combien de personnes (facultatif)<input name="minGuests" type="number" min="0" [(ngModel)]="draft.minGuests"></label>
        </div>
        <b>Produits du menu</b>
        @for (d of draft.dishes; track d; let i = $index) {
          <div class="dish">
            <select [name]="'product' + i" required aria-label="Produit" [(ngModel)]="d.product">
              <option value="">Choisir un produit…</option>
              @for (p of products(); track p.id) { <option [value]="p.id">{{ p.name_fr }}{{ p.available ? '' : ' (masqué)' }}</option> }
            </select>
            @if (isKg(d)) {
              <label class="amount"><input [name]="'grams' + i" type="number" min="10" step="10" required aria-label="Grammes par personne" [(ngModel)]="d.gramsEach"> g par personne</label>
            } @else {
              <label class="amount">1 pour <input [name]="'serves' + i" type="number" min="1" required aria-label="Nombre de personnes servies" [(ngModel)]="d.serves"> personnes</label>
            }
            <label class="check"><input type="checkbox" [name]="'side' + i" [(ngModel)]="d.side"> Accompagnement</label>
            <button type="button" class="btn danger small" aria-label="Retirer ce produit" [disabled]="draft.dishes.length === 1" (click)="draft.dishes.splice(i, 1)">✕</button>
            @if (extrasOf(d).length) {
              <div class="dish-extras">
                @for (x of extrasOf(d); track x) {
                  <label class="check"><input type="checkbox" [name]="'extra' + i + x" [ngModel]="d.extras?.includes(x)" (ngModelChange)="toggleExtra(d, x, $event)"> {{ x }}</label>
                }
              </div>
            }
          </div>
        }
        <div><button type="button" class="btn light small" (click)="draft.dishes.push(newDish())">+ Ajouter un produit</button></div>
        <p class="hint">« Accompagnement » : si ce produit manque, le menu reste proposé sans lui.</p>
        @if (error()) { <div class="msg">{{ error() }}</div> }
        <div class="modal-actions">
          <button type="button" class="btn light" (click)="dialog.close()">Annuler</button>
          <button class="btn" type="submit">Enregistrer</button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    .finder { display: grid; grid-template-columns: minmax(0, 1fr) 200px auto; gap: 10px; align-items: center; margin-bottom: 14px; max-width: 760px; }
    .finder span { color: var(--muted); font-size: .86rem; white-space: nowrap; }
    .dish { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; gap: 8px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); }
    .dish .amount { display: flex; align-items: center; gap: 6px; margin: 0; font-size: .86rem; white-space: nowrap; }
    .dish .amount input { width: 74px; }
    .dish-extras { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 4px 14px; }
    .hint { margin: 0; color: var(--muted); font-size: .84rem; }
    @media (max-width: 600px) { .dish { grid-template-columns: 1fr auto; } .finder { grid-template-columns: 1fr auto; } .finder input { grid-column: 1 / -1; } }
  `,
})
export class Menus implements OnInit {
  protected readonly data = inject(AdminData);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly styles = MENU_STYLES;
  protected readonly menus = signal<MenuRecipe[]>([]);
  protected readonly products = signal<Product[]>([]);
  protected readonly loaded = signal(false);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly style = signal('');
  protected readonly newDish = blankDish;
  protected readonly shown = computed(() => {
    const text = this.search().trim().toLowerCase();
    return this.menus().filter(m => (!this.style() || m.style === this.style())
      && (!text || `${m.name_fr} ${m.name_ar}`.toLowerCase().includes(text)));
  });
  protected editingId: string | null = null;
  protected draft: MenuRecipe = blankMenu();

  async ngOnInit() {
    const [menus, products] = await Promise.all([this.data.getMenus(), this.data.list<Product>('products')]);
    this.products.set([...products].sort((a, b) => a.name_fr.localeCompare(b.name_fr, 'fr')));
    this.menus.set(menus);
    this.loaded.set(true);
  }

  private product(d: Dish) {
    return this.products().find(p => p.id === d.product);
  }

  protected isKg(d: Dish) {
    return this.product(d)?.unit === 'kg';
  }

  protected extrasOf(d: Dish) {
    return this.product(d)?.custom?.extras.map(x => x.fr) ?? [];
  }

  protected styleName(id: MenuStyle) {
    return MENU_STYLES.find(s => s.id === id)?.label ?? id;
  }

  protected dishNames(m: MenuRecipe) {
    return m.dishes.map(d => this.product(d)?.name_fr ?? 'Produit supprimé').join(', ');
  }

  /** Prix calculé avec les prix du moment, pour repérer un menu sans prix ou indisponible. */
  protected preview(m: MenuRecipe) {
    const guests = Math.max(PREVIEW_GUESTS, m.minGuests ?? 0);
    const [menu] = planMenus(this.products(), { guests, budget: 0, style: m.style }, [{ ...m, hidden: false }]);
    if (!menu) return 'Indisponible';
    if (menu.pending) return 'Prix à confirmer';
    return `${formatNumber(menu.total)} DA / ${guests} pers.`;
  }

  protected toggleExtra(d: Dish, name: string, on: boolean) {
    const list = (d.extras ?? []).filter(x => x !== name);
    d.extras = on ? [...list, name] : list;
  }

  protected open(m: MenuRecipe | null) {
    this.editingId = m?.id ?? null;
    this.draft = m
      ? { ...structuredClone(m), dishes: m.dishes.map(d => ({ ...blankDish(), ...structuredClone(d) })) }
      : blankMenu();
    this.error.set('');
    this.dialog().nativeElement.showModal();
  }

  /** Ne garde que ce qui sert selon la vente du produit, au poids ou à la pièce. */
  private cleanDish(d: Dish): Dish {
    return {
      product: d.product,
      ...(this.isKg(d) ? { gramsEach: Number(d.gramsEach) || DEFAULT_GRAMS } : { serves: Number(d.serves) || 1 }),
      ...(d.side ? { side: true } : {}),
      ...(d.extras?.length && !this.isKg(d) ? { extras: d.extras } : {}),
    };
  }

  private async store(list: MenuRecipe[]) {
    await this.data.saveMenus(list);
    this.menus.set(list);
  }

  protected async save() {
    const d = this.draft;
    if (!d.name_fr.trim() || !d.name_ar.trim() || d.dishes.some(x => !x.product)) {
      this.error.set('Indiquez les deux noms et choisissez un produit sur chaque ligne.');
      return;
    }
    const menu: MenuRecipe = {
      id: this.editingId ?? `menu-${Date.now()}`, style: d.style, name_fr: d.name_fr.trim(), name_ar: d.name_ar.trim(),
      dishes: d.dishes.map(x => this.cleanDish(x)),
      ...(Number(d.minGuests) > 0 ? { minGuests: Number(d.minGuests) } : {}),
      ...(d.hidden ? { hidden: true } : {}),
    };
    const list = this.editingId ? this.menus().map(m => (m.id === menu.id ? menu : m)) : [menu, ...this.menus()];
    try {
      await this.store(list);
    } catch (e) {
      this.error.set((e as Error).message);
      return;
    }
    this.dialog().nativeElement.close();
    this.data.notify('Menu enregistré');
  }

  protected async toggle(m: MenuRecipe) {
    const { hidden, ...rest } = m;
    await this.store(this.menus().map(x => (x.id === m.id ? (hidden ? rest : { ...rest, hidden: true }) : x)));
  }

  protected async remove(m: MenuRecipe) {
    if (!confirm(`Supprimer le menu « ${m.name_fr} » ?`)) return;
    await this.store(this.menus().filter(x => x.id !== m.id));
    this.data.notify('Menu supprimé');
  }
}
