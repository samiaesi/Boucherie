import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { PromoCode, normalizeCode } from '../core/promo-codes';
import { localDay } from '../core/stats';
import { AdminData } from './admin-data';

const blank = () => ({ id: '', percent: 10 as number | null, until: '', minOrder: null as number | null, maxUses: null as number | null, note: '' });

@Component({
  selector: 'app-promo-codes-admin',
  imports: [FormsModule],
  template: `
    <div class="head"><h2>Codes promo et parrainage</h2></div>

    <form class="card-box" #f="ngForm" (ngSubmit)="create(f)">
      <h3>Nouveau code promo</h3>
      <div class="grid2">
        <label>Code (lettres et chiffres)<input name="id" required placeholder="AID10" autocomplete="off" [(ngModel)]="draft.id" (ngModelChange)="draft.id = clean($event)"></label>
        <label>Réduction (%)<input name="percent" type="number" min="1" max="90" required [(ngModel)]="draft.percent"></label>
        <label>Dernier jour (facultatif)<input name="until" type="date" [min]="today" [(ngModel)]="draft.until"></label>
        <label>Minimum d'achat en DA (facultatif)<input name="minOrder" type="number" min="0" step="100" [(ngModel)]="draft.minOrder"></label>
        <label>Utilisations au maximum (facultatif)<input name="maxUses" type="number" min="1" [(ngModel)]="draft.maxUses"></label>
        <label>Mémo (facultatif)<input name="note" placeholder="Publication Facebook de l'Aïd" [(ngModel)]="draft.note"></label>
      </div>
      @if (error()) { <div class="msg">{{ error() }}</div> }
      <div class="form-actions"><button class="btn" type="submit" [disabled]="f.invalid || busy()">Créer le code</button></div>
    </form>

    <div class="head list-head"><h3>Codes existants</h3></div>
    <div class="items">
      @for (c of codes(); track c.id) {
        <div class="item" [class.off]="!c.active || expired(c)">
          <div class="info">
            <b>{{ c.id }} · -{{ c.percent }} %
              @if (!c.active) { <span class="pill">Désactivé</span> } @else if (expired(c)) { <span class="pill">Expiré</span> }</b>
            <small>{{ c.uses }} utilisation(s){{ c.maxUses ? ' sur ' + c.maxUses : '' }}{{ c.until ? ' · jusqu\\'au ' + c.until : '' }}{{ c.minOrder ? ' · dès ' + c.minOrder + ' DA' : '' }}{{ c.note ? ' · ' + c.note : '' }}</small>
          </div>
          <div class="item-actions">
            <button class="btn light small" (click)="toggle(c)" [disabled]="busy()">{{ c.active ? 'Désactiver' : 'Activer' }}</button>
            <button class="btn danger small" [attr.aria-label]="'Supprimer ' + c.id" (click)="remove(c)" [disabled]="busy()">✕</button>
          </div>
        </div>
      } @empty {
        @if (loaded()) { <div class="empty">Aucun code pour le moment.</div> }
      }
    </div>

    <form class="card-box referral" (ngSubmit)="saveReferral()">
      <h3>Parrainage</h3>
      <p class="hint">Le client donne le <b>numéro de téléphone</b> d'un ami qui a déjà une carte de fidélité : il a une réduction, et l'ami gagne des points quand la commande est livrée ou récupérée. Mettez 0 pour désactiver.</p>
      <div class="grid2">
        <label>Réduction du nouveau client (%)<input name="refPercent" type="number" min="0" max="50" [(ngModel)]="refPercent"></label>
        <label>Points offerts au parrain<input name="refPoints" type="number" min="0" [(ngModel)]="refPoints"></label>
      </div>
      <div class="form-actions"><button class="btn" type="submit" [disabled]="busy()">Enregistrer le parrainage</button></div>
    </form>
  `,
  styles: `
    .card-box { max-width: 900px; margin-bottom: 22px; }
    .card-box h3, .list-head h3 { margin: 0 0 12px; font-family: Inter, sans-serif; font-size: 1.05rem; }
    .hint { color: var(--muted); margin: 0 0 12px; }
    .referral { margin-top: 26px; }
  `,
})
export class PromoCodesAdmin implements OnInit {
  protected readonly data = inject(AdminData);
  protected readonly codes = signal<PromoCode[]>([]);
  protected readonly loaded = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly today = localDay(new Date());
  protected readonly clean = normalizeCode;
  protected draft = blank();
  protected refPercent = this.data.settings().referralPercent ?? 0;
  protected refPoints = this.data.settings().referralPoints ?? 0;

  async ngOnInit() {
    await this.reload();
    this.loaded.set(true);
  }

  private async reload() {
    this.codes.set(await this.data.listPromoCodes());
  }

  protected expired(c: PromoCode) {
    return !!c.until && this.today > c.until;
  }

  private async run(task: () => Promise<void>, done: string) {
    this.busy.set(true);
    this.error.set('');
    try {
      await task();
      await this.reload();
      this.data.notify(done);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected create(form: NgForm) {
    const d = this.draft;
    const id = normalizeCode(d.id);
    if (!id || !(Number(d.percent) > 0)) return;
    if (this.codes().some(c => c.id === id)) {
      this.error.set(`Le code ${id} existe déjà.`);
      return;
    }
    const code: PromoCode = {
      id, percent: Math.min(90, Number(d.percent)), uses: 0, active: true,
      ...(d.until ? { until: d.until } : {}), ...(Number(d.minOrder) > 0 ? { minOrder: Number(d.minOrder) } : {}),
      ...(Number(d.maxUses) > 0 ? { maxUses: Number(d.maxUses) } : {}), ...(d.note.trim() ? { note: d.note.trim() } : {}),
    };
    return this.run(async () => {
      await this.data.savePromoCode(code);
      this.draft = blank();
      form.resetForm(blank());
    }, `Code ${id} créé`);
  }

  protected toggle(c: PromoCode) {
    return this.run(() => this.data.savePromoCode({ ...c, active: !c.active }), c.active ? `${c.id} désactivé` : `${c.id} activé`);
  }

  protected remove(c: PromoCode) {
    if (!confirm(`Supprimer le code ${c.id} ?`)) return;
    return this.run(() => this.data.deletePromoCode(c.id), `${c.id} supprimé`);
  }

  protected saveReferral() {
    return this.run(() => this.data.saveReferral(Math.max(0, Number(this.refPercent) || 0), Math.max(0, Number(this.refPoints) || 0)), 'Parrainage enregistré');
  }
}
