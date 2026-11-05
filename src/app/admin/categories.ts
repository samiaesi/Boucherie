import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category, ICON_NAMES } from '../core/data';
import { IconPipe } from '../core/icon';
import { AdminData } from './admin-data';

/** Nom de rayon → identifiant : « Préparations maison » → preparations-maison */
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

@Component({
  selector: 'app-categories',
  imports: [FormsModule, IconPipe],
  template: `
    <div class="head"><h2>Rayons de la boutique</h2></div>
    @if (loaded()) {
      <form class="card-box" (ngSubmit)="save()">
        @for (c of list; track c; let i = $index) {
          <div class="cat-row-admin">
            <div class="thumb" [innerHTML]="c.icon | icon"></div>
            <input [name]="'fr' + i" placeholder="Nom (français)" required [(ngModel)]="c.name_fr">
            <input [name]="'ar' + i" dir="rtl" placeholder="الاسم بالعربية" required [(ngModel)]="c.name_ar">
            <select [name]="'icon' + i" [(ngModel)]="c.icon">
              @for (n of iconNames; track n[0]) { <option [value]="n[0]">{{ n[1] }}</option> }
            </select>
            <button type="button" class="btn light small" [disabled]="i === 0" (click)="move(i, -1)">↑</button>
            <button type="button" class="btn light small" [disabled]="i === list.length - 1" (click)="move(i, 1)">↓</button>
            <button type="button" class="btn danger small" [attr.aria-label]="'Supprimer le rayon ' + c.name_fr" (click)="remove(i)">✕</button>
          </div>
        }
        <div><button type="button" class="btn light small" (click)="add()">+ Ajouter un rayon</button></div>
        @if (error()) { <div class="msg">{{ error() }}</div> }
        <div><button class="btn" type="submit" [disabled]="saving()">{{ saving() ? 'Enregistrement…' : 'Enregistrer' }}</button></div>
      </form>
    }
  `,
  styles: `
    .cat-row-admin { display: grid; grid-template-columns: 64px 1fr 1fr 170px auto auto auto; gap: 8px; align-items: center; }
    @media (max-width: 700px) { .cat-row-admin { grid-template-columns: 64px 1fr auto auto auto; } .cat-row-admin input, .cat-row-admin select { grid-column: 1 / -1; } }
  `,
})
export class Categories implements OnInit {
  private readonly data = inject(AdminData);
  protected readonly loaded = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly iconNames = Object.entries(ICON_NAMES);
  protected list: Category[] = [];

  async ngOnInit() {
    this.list = await this.data.getCategories();
    this.loaded.set(true);
  }

  protected add() {
    this.list.push({ id: '', order: this.list.length + 1, icon: 'boeuf', name_fr: '', name_ar: '' });
  }

  /** La suppression n'est définitive qu'après Enregistrer, mais la croix est vite cliquée. */
  protected remove(i: number) {
    const c = this.list[i];
    const count = this.data.products().filter(p => p.category === c.id).length;
    const warning = count ? `\n\n${count} produit(s) de ce rayon ne seront plus visibles dans le menu des rayons.` : '';
    if (confirm(`Supprimer le rayon « ${c.name_fr} » ?${warning}`)) this.list.splice(i, 1);
  }

  protected move(i: number, delta: number) {
    const [c] = this.list.splice(i, 1);
    this.list.splice(i + delta, 0, c);
  }

  protected async save() {
    const list = this.list.map((c, i) => ({ ...c, id: c.id || slug(c.name_fr), order: i + 1 }));
    this.saving.set(true);
    this.error.set('');
    try {
      await this.data.saveCategories(list);
      this.list = list;
      this.data.notify('Rayons enregistrés');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
