import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LoyaltyCard, normalizeTel, pointsFor, validTel } from '../core/loyalty';
import { AdminData } from './admin-data';

@Component({
  selector: 'app-loyalty-admin',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="head"><h2>Fidélité</h2></div>
    @if (!data.settings().loyaltyEnabled) {
      <div class="empty">La carte de fidélité est désactivée. Activez-la dans <a routerLink="/admin/parametres">Paramètres</a>.</div>
    }
    <form class="card-box store" (ngSubmit)="addStore()">
      <b>Achat en boutique</b>
      <div class="store-row">
        <input name="storeTel" type="tel" inputmode="tel" dir="ltr" placeholder="05 55 12 34 56" aria-label="Téléphone du client" [ngModel]="storeTel()" (ngModelChange)="storeTel.set($event)">
        <input name="storeAmount" type="number" min="0" step="50" placeholder="Montant en DA" aria-label="Montant en DA" [ngModel]="storeAmount()" (ngModelChange)="storeAmount.set($event)">
        <button class="btn" type="submit" [disabled]="!storePoints() || busy()">Ajouter {{ storePoints() }} points</button>
      </div>
    </form>
    <div class="finder">
      <input type="search" placeholder="Numéro de téléphone…" aria-label="Rechercher un client" [ngModel]="search()" (ngModelChange)="search.set($event)" name="search">
      <span>{{ shown().length }} / {{ cards().length }}</span>
    </div>
    @if (error()) { <div class="msg">{{ error() }}</div> }
    <div class="items">
      @for (c of shown(); track c.id) {
        <div class="item">
          <div class="info"><b dir="ltr">{{ c.id }}</b><small>{{ c.earned }} points gagnés au total</small></div>
          <div class="price">{{ c.points }} pts</div>
          <div class="item-actions">
            <button class="btn light small" [disabled]="!goal() || c.points < goal()" (click)="useGift(c)">Donner le cadeau (−{{ goal() }})</button>
            <button class="btn light small" (click)="adjust(c)">Corriger</button>
          </div>
        </div>
      } @empty {
        @if (loaded()) { <div class="empty">Aucune carte pour le moment. Les points arrivent quand une commande passe à « livré » ou « récupéré ».</div> }
      }
    </div>
  `,
  styles: `
    .finder { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; margin-bottom: 14px; max-width: 520px; }
    .finder span { color: var(--muted); font-size: .86rem; }
    .store { display: grid; gap: 10px; margin-bottom: 16px; max-width: 760px; }
    .store-row { display: grid; grid-template-columns: minmax(0, 1fr) 170px auto; gap: 10px; }
    @media (max-width: 600px) { .store-row { grid-template-columns: 1fr; } }
  `,
})
export class LoyaltyAdmin implements OnInit {
  protected readonly data = inject(AdminData);
  protected readonly cards = signal<LoyaltyCard[]>([]);
  protected readonly loaded = signal(false);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly goal = computed(() => this.data.settings().loyaltyGoal);
  protected readonly storeTel = signal('');
  protected readonly storeAmount = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly storePoints = computed(() => (validTel(this.storeTel())
    ? pointsFor(Number(this.storeAmount()) || 0, this.data.settings().loyaltyEvery) : 0));
  protected readonly shown = computed(() => {
    const text = this.search().replace(/\D/g, '');
    const key = text ? normalizeTel(text) : '';
    return this.cards().filter(c => !text || c.id.includes(text) || c.id === key).sort((a, b) => b.points - a.points);
  });

  async ngOnInit() {
    await this.reload();
  }

  private async reload() {
    try {
      this.cards.set(await this.data.listLoyalty());
    } catch (e) {
      this.error.set('Lecture impossible : publiez les nouvelles règles Firebase.');
      console.warn(e);
    }
    this.loaded.set(true);
  }

  protected async addStore() {
    if (!this.storePoints() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const points = await this.data.addStorePoints(this.storeTel(), Number(this.storeAmount()));
      this.data.notify(`${points} points ajoutés`);
      this.storeTel.set('');
      this.storeAmount.set(null);
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  private async change(c: LoyaltyCard, delta: number, reason: string) {
    try {
      await this.data.adjustPoints(c.id, delta, reason);
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  protected useGift(c: LoyaltyCard) {
    if (confirm(`Donner le cadeau au ${c.id} et retirer ${this.goal()} points ?`)) this.change(c, -this.goal(), 'Cadeau donné');
  }

  protected adjust(c: LoyaltyCard) {
    const value = prompt(`Nouveau solde de points pour ${c.id} :`, String(c.points));
    const points = Number(value);
    if (value === null || value.trim() === '' || !Number.isInteger(points) || points < 0) return;
    this.change(c, points - c.points, 'Correction manuelle');
  }
}
