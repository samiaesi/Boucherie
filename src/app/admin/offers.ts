import { Component, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DEFAULT_OFFERS, Offer, formatNumber } from '../core/data';
import { AdminData } from './admin-data';

/** Formulaire d'édition : les listes d'articles sont saisies une ligne par article. */
interface Draft {
  name_fr: string; name_ar: string; price: number; order: number;
  unit_fr: string; unit_ar: string; items_fr: string; items_ar: string;
  featured: boolean; available: boolean;
}

@Component({
  selector: 'app-offers',
  imports: [FormsModule],
  template: `
    <div class="head">
      <h2>Formules</h2>
      <div class="chips">
        @if (loaded() && !offers().length) {
          <button class="btn light" (click)="seed()">Importer les formules par défaut</button>
        }
        <button class="btn" (click)="open(null)">+ Ajouter une formule</button>
      </div>
    </div>
    <div class="items">
      @for (o of offers(); track o.id) {
        <div class="item" [class.off]="!o.available">
          <div class="info">
            <b>{{ o.name_fr }} <span class="ar">· {{ o.name_ar }}</span>
              @if (o.featured) { <span class="pill">En avant</span> }
              @if (!o.available) { <span class="pill">Masquée</span> }</b>
            <small>{{ o.items_fr.join(' · ') }}</small>
          </div>
          <div class="price">{{ num(o.price) }} DA <small>{{ o.unit_fr }}</small></div>
          <div class="item-actions">
            <button class="btn light small" (click)="toggle(o)">{{ o.available ? 'Masquer' : 'Afficher' }}</button>
            <button class="btn light small" (click)="open(o)">Modifier</button>
            <button class="btn danger small" (click)="remove(o)">✕</button>
          </div>
        </div>
      } @empty {
        @if (loaded()) {
          <div class="empty">Aucune formule dans Firebase : le site affiche les formules par défaut. Importez-les pour pouvoir les modifier.</div>
        }
      }
    </div>

    <dialog #dialog>
      <form class="modal" (ngSubmit)="save()">
        <h3>{{ editingId ? 'Modifier la formule' : 'Nouvelle formule' }}</h3>
        <div class="grid2">
          <label>Nom (français)<input name="name_fr" required [(ngModel)]="draft.name_fr"></label>
          <label>Nom (arabe)<input name="name_ar" dir="rtl" required [(ngModel)]="draft.name_ar"></label>
          <label>Prix (DA)<input name="price" type="number" min="0" step="50" required [(ngModel)]="draft.price"></label>
          <label>Ordre d'affichage<input name="order" type="number" min="0" [(ngModel)]="draft.order"></label>
          <label>Quantité (français)<input name="unit_fr" placeholder="/ 6 pers." [(ngModel)]="draft.unit_fr"></label>
          <label>Quantité (arabe)<input name="unit_ar" dir="rtl" placeholder="/ 6 أشخاص" [(ngModel)]="draft.unit_ar"></label>
          <label>Contenu (français, une ligne par article)<textarea name="items_fr" rows="4" [(ngModel)]="draft.items_fr"></textarea></label>
          <label>Contenu (arabe, une ligne par article)<textarea name="items_ar" dir="rtl" rows="4" [(ngModel)]="draft.items_ar"></textarea></label>
        </div>
        <label class="check"><input type="checkbox" name="featured" [(ngModel)]="draft.featured"> Mettre en avant (« Le plus demandé »)</label>
        <label class="check"><input type="checkbox" name="available" [(ngModel)]="draft.available"> Visible sur le site</label>
        @if (error()) { <div class="msg">{{ error() }}</div> }
        <div class="modal-actions">
          <button type="button" class="btn light" (click)="dialog.close()">Annuler</button>
          <button class="btn" type="submit">Enregistrer</button>
        </div>
      </form>
    </dialog>
  `,
})
export class Offers implements OnInit {
  private readonly data = inject(AdminData);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly offers = signal<Offer[]>([]);
  protected readonly loaded = signal(false);
  protected readonly error = signal('');
  protected readonly num = formatNumber;
  protected editingId: string | null = null;
  protected draft: Draft = this.toDraft(null);

  async ngOnInit() {
    await this.reload();
  }

  private async reload() {
    this.offers.set(await this.data.list<Offer>('offers'));
    this.loaded.set(true);
  }

  private toDraft(o: Offer | null): Draft {
    return {
      name_fr: o?.name_fr ?? '', name_ar: o?.name_ar ?? '', price: o?.price ?? 0,
      order: o?.order ?? (this.offers?.().length ?? 0) + 1,
      unit_fr: o?.unit_fr ?? '', unit_ar: o?.unit_ar ?? '',
      items_fr: (o?.items_fr ?? []).join('\n'), items_ar: (o?.items_ar ?? []).join('\n'),
      featured: o?.featured ?? false, available: o?.available ?? true,
    };
  }

  protected open(o: Offer | null) {
    this.editingId = o?.id ?? null;
    this.draft = this.toDraft(o);
    this.error.set('');
    this.dialog().nativeElement.showModal();
  }

  protected async save() {
    const d = this.draft;
    const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);
    try {
      await this.data.save('offers', this.editingId, {
        name_fr: d.name_fr.trim(), name_ar: d.name_ar.trim(),
        price: Number(d.price) || 0, order: Number(d.order) || 0,
        unit_fr: d.unit_fr.trim(), unit_ar: d.unit_ar.trim(),
        items_fr: lines(d.items_fr), items_ar: lines(d.items_ar),
        featured: d.featured, available: d.available,
      });
    } catch (e) {
      this.error.set((e as Error).message);
      return;
    }
    this.dialog().nativeElement.close();
    this.data.notify('Formule enregistrée');
    await this.reload();
  }

  protected async toggle(o: Offer) {
    await this.data.update('offers', o.id, { available: !o.available });
    await this.reload();
  }

  protected async remove(o: Offer) {
    if (!confirm(`Supprimer « ${o.name_fr} » ?`)) return;
    await this.data.remove('offers', o.id);
    this.data.notify('Formule supprimée');
    await this.reload();
  }

  protected async seed() {
    for (const { id, ...o } of DEFAULT_OFFERS) await this.data.save('offers', id, o);
    this.data.notify('Formules importées');
    await this.reload();
  }
}
