import { Component, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Product } from '../core/data';
import { Recipe, RecipeItem } from '../core/recipes';
import { AdminData } from './admin-data';

const blankItem = (): RecipeItem => ({ product: '', grams: 1000, qty: 1 });
const blank = (): Recipe => ({ id: '', name_fr: '', name_ar: '', steps_fr: '', steps_ar: '', minutes: 60, serves: 4, items: [blankItem()] });

@Component({
  selector: 'app-recipes-admin',
  imports: [FormsModule],
  template: `
    <div class="head">
      <h2>Recettes</h2>
      <div class="chips"><button class="btn" (click)="open(null)">+ Ajouter une recette</button></div>
    </div>
    <p class="hint">Affichées sur la page « Recettes » du site et sur la fiche des produits utilisés. Le client met tous les produits au panier en un clic.</p>
    <div class="items">
      @for (r of list(); track r.id) {
        <div class="item" [class.off]="r.hidden">
          <div class="info">
            <b>{{ r.name_fr }} <span class="ar">· {{ r.name_ar }}</span> @if (r.hidden) { <span class="pill">Masquée</span> }</b>
            <small>{{ r.minutes }} min · {{ r.serves }} pers. · {{ names(r) }}</small>
          </div>
          <div class="item-actions">
            <button class="btn light small" (click)="toggle(r)">{{ r.hidden ? 'Afficher' : 'Masquer' }}</button>
            <button class="btn light small" (click)="open(r)">Modifier</button>
            <button class="btn danger small" [attr.aria-label]="'Supprimer ' + r.name_fr" (click)="remove(r)">✕</button>
          </div>
        </div>
      }
    </div>

    <dialog #dialog>
      <form class="modal" (ngSubmit)="save()">
        <h3>{{ editingId ? 'Modifier la recette' : 'Nouvelle recette' }}</h3>
        <div class="grid2">
          <label>Nom (français)<input name="name_fr" required [(ngModel)]="draft.name_fr"></label>
          <label>Nom (arabe)<input name="name_ar" dir="rtl" required [(ngModel)]="draft.name_ar"></label>
          <label>Durée (minutes)<input name="minutes" type="number" min="5" [(ngModel)]="draft.minutes"></label>
          <label>Personnes<input name="serves" type="number" min="1" [(ngModel)]="draft.serves"></label>
        </div>
        <b>Produits à acheter</b>
        @for (it of draft.items; track $index; let i = $index) {
          <div class="row">
            <select [name]="'p' + i" required aria-label="Produit" [(ngModel)]="it.product">
              <option value="">Choisir un produit…</option>
              @for (p of products(); track p.id) { <option [value]="p.id">{{ p.name_fr }}</option> }
            </select>
            @if (isKg(it)) {
              <label class="amount"><input [name]="'g' + i" type="number" min="50" step="50" aria-label="Grammes" [(ngModel)]="it.grams"> g</label>
            } @else {
              <label class="amount"><input [name]="'q' + i" type="number" min="1" aria-label="Pièces" [(ngModel)]="it.qty"> pièce(s)</label>
            }
            <button type="button" class="btn danger small" aria-label="Retirer ce produit" [disabled]="draft.items.length === 1" (click)="draft.items.splice(i, 1)">✕</button>
          </div>
        }
        <div><button type="button" class="btn add-row" (click)="draft.items.push(newItem())">+ Ajouter un produit</button></div>
        <label>Préparation (français), une étape par ligne<textarea name="steps_fr" rows="5" required [(ngModel)]="draft.steps_fr"></textarea></label>
        <label>Préparation (arabe), une étape par ligne<textarea name="steps_ar" rows="5" dir="rtl" required [(ngModel)]="draft.steps_ar"></textarea></label>
        @if (error()) { <div class="msg">{{ error() }}</div> }
        <div class="modal-actions">
          <button type="button" class="btn light" (click)="dialog.close()">Annuler</button>
          <button class="btn" type="submit">Enregistrer</button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    .hint { color: var(--muted); margin-bottom: 14px; }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; }
    .amount { display: flex; align-items: center; gap: 6px; margin: 0; white-space: nowrap; }
    .amount input { width: 90px; }
  `,
})
export class RecipesAdmin implements OnInit {
  private readonly data = inject(AdminData);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly list = signal<Recipe[]>([]);
  protected readonly products = signal<Product[]>([]);
  protected readonly error = signal('');
  protected readonly newItem = blankItem;
  protected editingId: string | null = null;
  protected draft: Recipe = blank();

  async ngOnInit() {
    const [list, products] = await Promise.all([this.data.getRecipes(), this.data.list<Product>('products')]);
    this.products.set([...products].sort((a, b) => a.name_fr.localeCompare(b.name_fr, 'fr')));
    this.list.set(list);
  }

  protected isKg(it: RecipeItem) {
    return this.products().find(p => p.id === it.product)?.unit !== 'piece';
  }

  protected names(r: Recipe) {
    return r.items.map(i => this.products().find(p => p.id === i.product)?.name_fr ?? 'Produit supprimé').join(', ');
  }

  protected open(r: Recipe | null) {
    this.editingId = r?.id ?? null;
    this.draft = r ? structuredClone(r) : blank();
    this.error.set('');
    this.dialog().nativeElement.showModal();
  }

  private async store(list: Recipe[]) {
    await this.data.saveRecipes(list);
    this.list.set(list);
  }

  protected async save() {
    const d = this.draft;
    if (!d.name_fr.trim() || !d.name_ar.trim() || d.items.some(i => !i.product) || !d.steps_fr.trim()) {
      this.error.set('Indiquez les deux noms, la préparation et un produit sur chaque ligne.');
      return;
    }
    const recipe: Recipe = {
      id: this.editingId ?? `recette-${Date.now()}`, name_fr: d.name_fr.trim(), name_ar: d.name_ar.trim(),
      steps_fr: d.steps_fr.trim(), steps_ar: d.steps_ar.trim(), minutes: Number(d.minutes) || 30, serves: Number(d.serves) || 4,
      items: d.items.map(i => (this.isKg(i) ? { product: i.product, grams: Number(i.grams) || 1000 } : { product: i.product, qty: Number(i.qty) || 1 })),
      ...(d.hidden ? { hidden: true } : {}),
    };
    const list = this.editingId ? this.list().map(r => (r.id === recipe.id ? recipe : r)) : [recipe, ...this.list()];
    try {
      await this.store(list);
    } catch (e) {
      this.error.set((e as Error).message);
      return;
    }
    this.dialog().nativeElement.close();
    this.data.notify('Recette enregistrée');
  }

  protected async toggle(r: Recipe) {
    const { hidden, ...rest } = r;
    await this.store(this.list().map(x => (x.id === r.id ? (hidden ? rest : { ...rest, hidden: true }) : x)));
  }

  protected async remove(r: Recipe) {
    if (!confirm(`Supprimer la recette « ${r.name_fr} » ?`)) return;
    await this.store(this.list().filter(x => x.id !== r.id));
    this.data.notify('Recette supprimée');
  }
}
