import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Campaign, blankCampaign } from '../core/campaigns';
import { Product } from '../core/data';
import { AdminData } from './admin-data';

@Component({
  selector: 'app-reservations',
  imports: [FormsModule],
  template: `
    <div class="head">
      <h2>Réservations</h2>
      <div class="chips"><button class="btn" (click)="open(null)">+ Créer une réservation</button></div>
    </div>
    <p class="hint">Aïd, Ramadan… Les réservations des clients arrivent dans <b>Commandes</b>.</p>
    <div class="items">
      @for (c of list(); track c.id) {
        <div class="item" [class.off]="!c.active">
          <div class="info">
            <b>{{ c.name_fr }} <span class="ar">· {{ c.name_ar }}</span>
              @if (!c.active) { <span class="pill">Désactivée</span> }</b>
            <small>Réserver jusqu'au {{ c.closes }} · Retrait du {{ c.pickupFrom }} au {{ c.pickupTo }} · {{ c.products.length }} produit(s)</small>
          </div>
          <div class="item-actions">
            <button class="btn light small" (click)="open(c)">Modifier</button>
            <button class="btn danger small" [attr.aria-label]="'Supprimer ' + c.name_fr" (click)="remove(c)">✕</button>
          </div>
        </div>
      } @empty {
        @if (loaded()) { <div class="empty">Aucune réservation pour le moment.</div> }
      }
    </div>

    <dialog #dialog>
      <form class="modal" (ngSubmit)="save()">
        <h3>{{ editingId ? 'Modifier la réservation' : 'Nouvelle réservation' }}</h3>
        <div class="grid2">
          <label>Nom (français)<input name="name_fr" required placeholder="Mouton de l'Aïd" [(ngModel)]="draft.name_fr"></label>
          <label>Nom (arabe)<input name="name_ar" dir="rtl" required [(ngModel)]="draft.name_ar"></label>
          <label>Texte (français)<textarea name="text_fr" rows="2" [(ngModel)]="draft.text_fr"></textarea></label>
          <label>Texte (arabe)<textarea name="text_ar" dir="rtl" rows="2" [(ngModel)]="draft.text_ar"></textarea></label>
          <label>Dernier jour pour réserver<input name="closes" type="date" required [(ngModel)]="draft.closes"></label>
          <label>Acompte par article (DA, 0 = aucun)<input name="deposit" type="number" min="0" step="500" [(ngModel)]="draft.deposit"></label>
          <label>Premier jour de retrait<input name="pickupFrom" type="date" required [(ngModel)]="draft.pickupFrom"></label>
          <label>Dernier jour de retrait<input name="pickupTo" type="date" required [(ngModel)]="draft.pickupTo"></label>
        </div>
        <b>Produits à réserver</b>
        <div class="pick-products">
          @for (p of products(); track p.id) {
            <label class="check"><input type="checkbox" [name]="'p' + p.id" [ngModel]="draft.products.includes(p.id)" (ngModelChange)="toggleProduct(p.id, $event)"> {{ p.name_fr }}</label>
          }
        </div>
        <label class="check"><input type="checkbox" name="active" [(ngModel)]="draft.active"> Visible sur le site</label>
        @if (error()) { <div class="msg">{{ error() }}</div> }
        <div class="modal-actions">
          <button type="button" class="btn light" (click)="dialog.close()">Annuler</button>
          <button class="btn" type="submit">Enregistrer</button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    .hint { margin: 0 0 14px; color: var(--muted); font-size: .88rem; }
    .pick-products { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 4px 12px; max-height: 190px; overflow: auto; padding: 8px; border: 1px solid var(--border); border-radius: 12px; }
  `,
})
export class Reservations implements OnInit {
  protected readonly data = inject(AdminData);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly list = signal<Campaign[]>([]);
  private readonly allProducts = signal<Product[]>([]);
  /** Les produits personnalisés ont leur propre parcours */
  protected readonly products = computed(() => this.allProducts().filter(p => !p.custom).sort((a, b) => a.name_fr.localeCompare(b.name_fr, 'fr')));
  protected readonly loaded = signal(false);
  protected readonly error = signal('');
  protected editingId: string | null = null;
  protected draft: Campaign = blankCampaign();

  async ngOnInit() {
    const [list, products] = await Promise.all([this.data.getCampaigns(), this.data.list<Product>('products')]);
    this.list.set(list);
    this.allProducts.set(products);
    this.loaded.set(true);
  }

  protected open(c: Campaign | null) {
    this.editingId = c?.id ?? null;
    this.draft = c ? structuredClone(c) : blankCampaign();
    this.error.set('');
    this.dialog().nativeElement.showModal();
  }

  protected toggleProduct(id: string, on: boolean) {
    const rest = this.draft.products.filter(x => x !== id);
    this.draft.products = on ? [...rest, id] : rest;
  }

  protected async save() {
    const d = this.draft;
    if (!d.name_fr.trim() || !d.name_ar.trim() || !d.closes || !d.pickupFrom || !d.pickupTo) {
      this.error.set('Indiquez les deux noms et les trois dates.');
      return;
    }
    if (d.pickupTo < d.pickupFrom) {
      this.error.set('Le dernier jour de retrait doit venir après le premier.');
      return;
    }
    if (!d.products.length) {
      this.error.set('Choisissez au moins un produit.');
      return;
    }
    const item: Campaign = { ...d, id: this.editingId ?? `res-${Date.now()}`, name_fr: d.name_fr.trim(), name_ar: d.name_ar.trim(), deposit: Number(d.deposit) || 0 };
    const list = this.editingId ? this.list().map(c => (c.id === item.id ? item : c)) : [item, ...this.list()];
    try {
      await this.data.saveCampaigns(list);
    } catch (e) {
      this.error.set((e as Error).message);
      return;
    }
    this.list.set(list);
    this.dialog().nativeElement.close();
    this.data.notify('Réservation enregistrée');
  }

  protected async remove(c: Campaign) {
    if (!confirm(`Supprimer « ${c.name_fr} » ? Les réservations déjà reçues restent dans Commandes.`)) return;
    const list = this.list().filter(x => x.id !== c.id);
    await this.data.saveCampaigns(list);
    this.list.set(list);
  }
}
