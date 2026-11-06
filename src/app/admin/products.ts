import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { COUNTRIES, Category, CustomChoice, DEFAULT_CATEGORIES, DEFAULT_CUSTOM, DEFAULT_PRODUCTS, ICONS, Product, ProductOrigin, formatNumber, isCabinet, originLabel, originsOf } from '../core/data';
import { productRef, referenceTakenBy, searchProducts } from '../core/product-search';
import { customReady } from '../core/special-custom';
import { AdminData } from './admin-data';
import { resizeImage } from './image';

/** Formulaire d'édition : poids et découpes sont saisis comme du texte. */
type Draft = Omit<Product, 'id' | 'weights' | 'options_fr' | 'options_ar'> & {
  weights: string; options_fr: string; options_ar: string;
};

const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);

@Component({
  selector: 'app-products',
  imports: [FormsModule],
  template: `
    <div class="head">
      <h2>Produits</h2>
      <div class="chips">
        @if (loaded() && missing().length) {
          <button class="btn light" (click)="seed()">Importer les produits par défaut ({{ missing().length }})</button>
        }
        <button class="btn" (click)="open(null)">+ Ajouter un produit</button>
      </div>
    </div>
    <div class="finder">
      <input type="search" placeholder="Référence, nom, rayon ou pays…" aria-label="Rechercher un produit" [ngModel]="search()" (ngModelChange)="search.set($event)" name="search">
      <select aria-label="Rayon" [ngModel]="rayon()" (ngModelChange)="rayon.set($event)" name="rayon">
        <option value="">Tous les rayons</option>
        @for (c of categories(); track c.id) { <option [value]="c.id">{{ c.name_fr }}</option> }
      </select>
      <span>{{ shown().length }} / {{ products().length }}</span>
    </div>
    <div class="items">
      @for (p of shown(); track p.id) {
        <div class="item" [class.off]="!p.available">
          <div class="thumb">
            @if (p.image) { <img [src]="p.image" alt=""> } @else { <span [innerHTML]="icon(p.category)"></span> }
          </div>
          <div class="info">
            <b>{{ p.name_fr }} <span class="ar">· {{ p.name_ar }}</span>
              @if (!p.available) { <span class="pill">Masqué</span> }</b>
            <small>Réf. {{ ref(p) }} · {{ rayonName(p) }}{{ origin(p) ? ' · ' + origin(p) : '' }}</small>
          </div>
          <div class="price">{{ price(p) }}</div>
          <div class="item-actions">
            <button class="btn light small" (click)="toggle(p)">{{ p.available ? 'Masquer' : 'Afficher' }}</button>
            <button class="btn light small" (click)="open(p)">Modifier</button>
            <button class="btn danger small" (click)="remove(p)">✕</button>
          </div>
        </div>
      } @empty {
        @if (loaded() && products().length) {
          <div class="empty">Aucun produit trouvé.</div>
        } @else if (loaded()) {
          <div class="empty">Aucun produit dans Firebase : le site affiche les produits par défaut. Importez-les pour pouvoir les modifier.</div>
        }
      }
    </div>

    <dialog #dialog>
      <form class="modal" (ngSubmit)="save()">
        <h3>{{ editingId ? 'Modifier le produit' : 'Nouveau produit' }}</h3>
        <div class="grid2">
          <label>Référence<input name="reference" autocomplete="off" [placeholder]="editingId ? editingId.toUpperCase() : 'Automatique'" [(ngModel)]="draft.reference"></label>
          <label>Étiquette de gras
            <select name="fat" [ngModel]="draft.fat ?? ''" (ngModelChange)="draft.fat = $event || undefined">
              <option value="">Aucune</option>
              <option value="low">Faible en gras</option>
              <option value="none">Sans gras</option>
            </select>
          </label>
          <div class="origin-rows">
            <b>Pays d'origine et prix</b>
            <datalist id="countries">@for (c of countries; track c.fr) { <option [value]="c.fr"></option> }</datalist>
            @for (r of rows; track r; let i = $index) {
              <div class="origin-row">
                <input [name]="'country' + i" list="countries" autocomplete="off" required placeholder="Espagne" aria-label="Pays" [(ngModel)]="r.country">
                <input [name]="'countryPrice' + i" type="number" min="0" step="10" aria-label="Prix en DA" [(ngModel)]="r.price">
                <label class="check"><input type="checkbox" [name]="'countryOn' + i" [ngModel]="r.available !== false" (ngModelChange)="r.available = $event"> Disponible</label>
                <button type="button" class="btn danger small" aria-label="Retirer ce pays" (click)="removeRow(i)">✕</button>
              </div>
            }
            <div><button type="button" class="btn light small" (click)="addRow()">+ Ajouter un pays</button></div>
            @if (rows.length) {
              <label class="check"><input type="checkbox" name="originAll" [(ngModel)]="originAll"> Mettre ces pays sur tous les produits de ce rayon, avec les mêmes écarts de prix</label>
            }
          </div>
          <label>Nom (français)<input name="name_fr" required [(ngModel)]="draft.name_fr"></label>
          <label>Nom (arabe)<input name="name_ar" dir="rtl" required [(ngModel)]="draft.name_ar"></label>
          <label>Description (français)<textarea name="desc_fr" rows="2" [(ngModel)]="draft.desc_fr"></textarea></label>
          <label>Description (arabe)<textarea name="desc_ar" dir="rtl" rows="2" [(ngModel)]="draft.desc_ar"></textarea></label>
          <label>Stock
            <select name="source" [(ngModel)]="draft.source">
              <option value="">Automatique</option>
              @for (f of reserves(); track f.id) { <option [value]="f.id">Réserve {{ f.name }}</option> }
              <option value="none">Stock propre au produit</option>
            </select>
          </label>
          <label>Rayon
            <select name="category" [(ngModel)]="draft.category">
              @for (c of categories(); track c.id) { <option [value]="c.id">{{ c.name_fr }}</option> }
            </select>
          </label>
          @if (!draft.custom) {
            <label>Prix
              <select name="unit" [(ngModel)]="draft.unit">
                <option value="kg">Prix au kg</option>
                <option value="piece">Prix à la pièce</option>
                <option value="order">Sur commande (sans prix)</option>
              </select>
            </label>
          }
          <label>{{ draft.custom ? 'Prix de base avec main-d\'œuvre (DA), jamais affiché au client" : 'Prix (DA)' }}<input name="price" type="number" min="0" step="10" [(ngModel)]="draft.price"></label>
          @if (draft.special && draft.custom; as c) {
            <div class="origin-rows">
              <b>Viande hachée : prix au kg</b>
              @for (m of c.meats; track m; let i = $index) {
                <div class="custom-row">
                  <input [name]="'meatFr' + i" required placeholder="Poulet" aria-label="Viande en français" [(ngModel)]="m.fr">
                  <input [name]="'meatAr' + i" dir="rtl" required aria-label="Viande en arabe" [(ngModel)]="m.ar">
                  <input [name]="'meatPrice' + i" type="number" min="0" step="10" aria-label="Prix au kg en DA" [(ngModel)]="m.price">
                  <button type="button" class="btn danger small" aria-label="Retirer cette viande" (click)="c.meats.splice(i, 1)">✕</button>
                </div>
              }
              <div><button type="button" class="btn light small" (click)="addChoice(c.meats)">+ Ajouter une viande</button></div>
              <label>Poids de viande proposés en grammes, séparés par des virgules
                <input name="customGrams" placeholder="250, 500, 750, 1000" [(ngModel)]="customGrams">
              </label>
              <b>Ingrédients supplémentaires : prix en DA (0 = offert)</b>
              @for (x of c.extras; track x; let i = $index) {
                <div class="custom-row">
                  <input [name]="'extraFr' + i" required placeholder="Champignons" aria-label="Ingrédient en français" [(ngModel)]="x.fr">
                  <input [name]="'extraAr' + i" dir="rtl" required aria-label="Ingrédient en arabe" [(ngModel)]="x.ar">
                  <input [name]="'extraPrice' + i" type="number" min="0" step="10" aria-label="Prix en DA" [(ngModel)]="x.price">
                  <button type="button" class="btn danger small" aria-label="Retirer cet ingrédient" (click)="c.extras.splice(i, 1)">✕</button>
                </div>
              }
              <div><button type="button" class="btn light small" (click)="addChoice(c.extras)">+ Ajouter un ingrédient</button></div>
            </div>
          }
          <label>Ordre d'affichage<input name="order" type="number" min="0" [(ngModel)]="draft.order"></label>
          @if (draft.unit === 'kg') {
            <label style="grid-column:1/-1">Poids proposés en grammes, séparés par des virgules
              <input name="weights" placeholder="250, 500, 1000, 2000" [(ngModel)]="draft.weights">
            </label>
          }
          <label>Découpes (français, une par ligne)<textarea name="options_fr" rows="3" placeholder="Entier&#10;Escalopes&#10;Émincé" [(ngModel)]="draft.options_fr"></textarea></label>
          <label>Découpes (arabe, une par ligne)<textarea name="options_ar" dir="rtl" rows="3" [(ngModel)]="draft.options_ar"></textarea></label>
        </div>
        <div class="preview">
          <div class="thumb">
            @if (image()) { <img [src]="image()" alt=""> } @else { <span [innerHTML]="icon(draft.category)"></span> }
          </div>
          <label style="flex:1">Photo (facultatif)<input type="file" accept="image/*" (change)="pickImage($event)"></label>
          <button type="button" class="btn light small" (click)="image.set(null)">Retirer</button>
        </div>
        <label class="check"><input type="checkbox" name="available" [(ngModel)]="draft.available"> Visible sur le site</label>
        <label class="check"><input type="checkbox" name="featured" [(ngModel)]="draft.featured"> Afficher dans « Les coupes préférées »</label>
        <label class="check"><input type="checkbox" name="special" [(ngModel)]="draft.special"> Commande spéciale : réservation au moins 6 h à l'avance, avec créneau de retrait</label>
        @if (draft.special) {
          <label class="check"><input type="checkbox" name="customOn" [ngModel]="!!draft.custom" (ngModelChange)="setCustom($event)"> Le client personnalise : viande hachée, poids et ingrédients</label>
        }
        @if (error()) { <div class="msg">{{ error() }}</div> }
        <div class="modal-actions">
          <button type="button" class="btn light" (click)="dialog.close()">Annuler</button>
          <button class="btn" type="submit">Enregistrer</button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    .origin-rows { grid-column: 1 / -1; display: grid; gap: 8px; }
    .origin-row { display: grid; grid-template-columns: minmax(0, 1fr) 120px auto auto; gap: 8px; align-items: center; }
    .custom-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 110px auto; gap: 8px; align-items: center; }
    .finder { display: grid; grid-template-columns: minmax(0, 1fr) 220px auto; gap: 10px; align-items: center; margin-bottom: 14px; max-width: 760px; }
    .finder span { color: var(--muted); font-size: .86rem; white-space: nowrap; }
    @media (max-width: 600px) { .finder { grid-template-columns: 1fr auto; } .finder input { grid-column: 1 / -1; } }
  `,
})
export class Products implements OnInit {
  protected readonly data = inject(AdminData);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly products = signal<Product[]>([]);
  protected readonly loaded = signal(false);
  /** Produits du catalogue pas encore dans Firebase */
  protected readonly missing = computed(() => DEFAULT_PRODUCTS.filter(d => !this.products().some(p => p.id === d.id)));
  protected readonly image = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly categories = signal<Category[]>([]);
  protected readonly reserves = computed(() => this.data.fridge().filter(f => !isCabinet(f)));
  protected readonly countries = COUNTRIES;
  protected originAll = false;
  protected rows: ProductOrigin[] = [];
  protected customGrams = '';
  protected readonly origin = originLabel;
  protected readonly search = signal('');
  protected readonly rayon = signal('');
  protected readonly ref = productRef;
  protected readonly shown = computed(() => searchProducts(this.products(), p => p, this.search(), this.rayon(), this.categories()));
  protected editingId: string | null = null;
  protected draft: Draft = this.toDraft(this.blank());

  private readonly icons: Record<string, SafeHtml> = Object.fromEntries(
    Object.entries(ICONS).map(([k, v]) => [k, this.sanitizer.bypassSecurityTrustHtml(v)]),
  );

  async ngOnInit() {
    this.categories.set(await this.data.getCategories());
    await this.reload();
    // Arrivée depuis un rayonnage du frigo : la fiche s'ouvre directement
    const edit = this.route.snapshot.queryParamMap.get('edit');
    const product = this.products().find(p => p.id === edit);
    if (product) this.open(product);
  }

  private blank(): Product {
    return { id: '', category: this.categories?.()[0]?.id ?? 'poulet', unit: 'kg', price: 0, available: true,
      order: this.products?.().length + 1 || 1, name_fr: '', name_ar: '', desc_fr: '', desc_ar: '' };
  }

  private toDraft(p: Product): Draft {
    const { id, image, ...rest } = p;
    return {
      ...rest, source: p.source ?? '', featured: !!p.featured, weights: (p.weights ?? [250, 500, 1000, 2000]).join(', '),
      options_fr: (p.options_fr ?? []).join('\n'), options_ar: (p.options_ar ?? []).join('\n'),
      custom: p.custom ? structuredClone(p.custom) : undefined,
    };
  }

  private async reload() {
    this.products.set(await this.data.list<Product>('products'));
    this.loaded.set(true);
  }

  protected icon(category: string) {
    const name = this.categories().find(c => c.id === category)?.icon ?? '';
    return this.icons[name] ?? this.icons['boeuf'];
  }

  protected addRow() {
    this.rows.push({ country: '', price: Number(this.draft.price) || 0 });
  }

  protected removeRow(i: number) {
    this.rows.splice(i, 1);
  }

  protected setCustom(on: boolean) {
    this.draft.custom = on ? structuredClone(DEFAULT_CUSTOM) : undefined;
    this.customGrams = on ? DEFAULT_CUSTOM.grams.join(', ') : '';
  }

  protected addChoice(list: CustomChoice[]) {
    list.push({ fr: '', ar: '', price: 0 });
  }

  protected rayonName(p: Product) {
    return this.categories().find(c => c.id === p.category)?.name_fr ?? p.category;
  }

  protected price(p: Product) {
    if (p.custom) return customReady(p) ? 'Prix personnalisé' : 'Prix à compléter';
    if (p.unit === 'order' || !p.price) return 'Sur commande';
    return `${formatNumber(p.price)} DA / ${p.unit === 'piece' ? 'pièce' : 'kg'}`;
  }

  protected open(p: Product | null) {
    this.editingId = p?.id ?? null;
    this.draft = this.toDraft(p ?? this.blank());
    this.originAll = false;
    this.rows = p ? originsOf(p).map(o => ({ ...o })) : [];
    this.customGrams = p?.custom?.grams.join(', ') ?? '';
    this.image.set(p?.image ?? null);
    this.error.set('');
    this.dialog().nativeElement.showModal();
  }

  protected async pickImage(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    try {
      this.image.set(await resizeImage(file, 700, 300_000));
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  protected async save() {
    const d = this.draft;
    const reference = (d.reference ?? '').trim();
    const taken = referenceTakenBy(reference, this.editingId, this.products());
    if (taken) {
      this.error.set(`La référence ${reference} est déjà utilisée par ${taken.name_fr}.`);
      return;
    }
    const data: Omit<Product, 'id'> = {
      ...d, name_fr: d.name_fr.trim(), name_ar: d.name_ar.trim(), desc_fr: d.desc_fr.trim(), desc_ar: d.desc_ar.trim(),
      price: Number(d.price) || 0, order: Number(d.order) || 0,
      weights: d.weights.split(/[,;\s]+/).map(Number).filter(w => w > 0),
      options_fr: lines(d.options_fr), options_ar: lines(d.options_ar),
    };
    if (!data.source) delete data.source;
    if (!data.fat) delete data.fat;
    if (!data.special) delete data.special;
    if (data.special && d.custom) {
      const choices = (list: CustomChoice[]) => list.map(c => ({ fr: c.fr.trim(), ar: c.ar.trim(), price: Number(c.price) || 0 }));
      data.custom = {
        meats: choices(d.custom.meats), extras: choices(d.custom.extras),
        grams: this.customGrams.split(/[,;\s]+/).map(Number).filter(w => w > 0),
      };
      data.unit = 'order';
    } else delete data.custom;
    if (reference) data.reference = reference;
    else delete data.reference;
    const rows = this.rows.filter(r => r.country.trim()).map(r => ({
      country: r.country.trim(), price: Number(r.price) || 0, ...(r.available === false ? { available: false } : {}),
    }));
    delete data.origin;
    if (rows.length) data.origins = rows;
    else delete data.origins;
    const image = this.image();
    if (image) data.image = image;
    try {
      await this.data.save('products', this.editingId, data);
      if (this.originAll && rows.length) {
        const others = this.products().filter(p => p.category === data.category && p.id !== this.editingId);
        await Promise.all(others.map(p => this.data.update('products', p.id, {
          origins: rows.map(r => ({ ...r, price: Math.max(0, p.price + r.price - data.price) })),
        })));
      }
    } catch (e) {
      this.error.set((e as Error).message);
      return;
    }
    this.dialog().nativeElement.close();
    this.data.notify('Produit enregistré');
    await this.reload();
  }

  protected async toggle(p: Product) {
    await this.data.update('products', p.id, { available: !p.available });
    await this.reload();
  }

  protected async remove(p: Product) {
    if (!confirm(`Supprimer « ${p.name_fr} » ?`)) return;
    await this.data.remove('products', p.id);
    this.data.notify('Produit supprimé');
    await this.reload();
  }

  protected async seed() {
    const known = this.categories();
    await this.data.saveCategories([...known, ...DEFAULT_CATEGORIES.filter(c => !known.some(k => k.id === c.id))]);
    for (const { id, ...p } of this.missing()) await this.data.save('products', id, p);
    this.categories.set(await this.data.getCategories());
    this.data.notify('Produits importés');
    await this.reload();
  }
}
