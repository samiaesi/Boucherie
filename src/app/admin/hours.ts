import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClosedDay, ClosedSlot, DaySchedule, OrderingRules, WEEK_ORDER, orderingState } from '../core/ordering';
import { AdminData } from './admin-data';

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

@Component({
  selector: 'app-hours',
  imports: [FormsModule],
  template: `
    <div class="head"><h2>Horaires et commandes</h2></div>

    <div class="status" [class.closed]="!state().open">
      <b>{{ state().open ? 'Commandes ouvertes' : 'Commandes fermées' }}</b>
      <span>{{ statusText() }}</span>
    </div>

    <section class="card-box pause">
      <div>
        <h3>Fermeture immédiate</h3>
        <p>Maintenance, boutique fermée… Le site refuse les commandes jusqu'à la réouverture.</p>
      </div>
      <input placeholder="Motif affiché aux clients (facultatif)" aria-label="Motif" [(ngModel)]="pauseReason" name="reason">
      <button class="btn" [class.danger]="!paused()" (click)="togglePause()" [disabled]="busy()">
        {{ paused() ? 'Rouvrir les commandes' : 'Fermer les commandes' }}
      </button>
    </section>

    <form class="card-box" (ngSubmit)="save()">
      <h3>Horaires de la semaine</h3>
      @for (d of schedule(); track d.day) {
        <div class="day" [class.off]="!d.open">
          <label class="check"><input type="checkbox" [name]="'o' + d.day" [(ngModel)]="d.open"> {{ dayName(d.day) }}</label>
          <input type="time" [name]="'f' + d.day" [(ngModel)]="d.from" [disabled]="!d.open" aria-label="Ouverture">
          <input type="time" [name]="'t' + d.day" [(ngModel)]="d.to" [disabled]="!d.open" aria-label="Fermeture">
        </div>
      }

      <h3>Créneaux sans commande</h3>
      <small class="hint">Exemple : de 06:00 à 09:00. Sans date, le créneau s'applique tous les jours.</small>
      @for (s of slots(); track s; let i = $index) {
        <div class="line">
          <input type="date" [name]="'sd' + i" aria-label="Date" [(ngModel)]="s.date">
          <input type="time" [name]="'sf' + i" required aria-label="De" [(ngModel)]="s.from">
          <input type="time" [name]="'st' + i" required aria-label="À" [(ngModel)]="s.to">
          <button type="button" class="btn danger small" (click)="removeSlot(i)">✕</button>
        </div>
      }
      <div><button type="button" class="btn light small" (click)="addSlot()">+ Ajouter un créneau</button></div>

      <h3>Jours de fermeture exceptionnelle</h3>
      @for (d of days(); track d; let i = $index) {
        <div class="line two">
          <input type="date" [name]="'cd' + i" required aria-label="Date" [(ngModel)]="d.date">
          <input [name]="'cr' + i" placeholder="Motif (Aïd, congé…)" aria-label="Motif" [(ngModel)]="d.reason">
          <button type="button" class="btn danger small" (click)="removeDay(i)">✕</button>
        </div>
      }
      <div><button type="button" class="btn light small" (click)="addDay()">+ Ajouter un jour</button></div>

      @if (error()) { <div class="msg">{{ error() }}</div> }
      <div><button class="btn" type="submit" [disabled]="busy()">Enregistrer les horaires</button></div>
    </form>
  `,
  styles: `
    .status { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; padding: 12px 16px; border-radius: 12px; background: #e7f4ec; color: var(--green); }
    .status.closed { background: #fbeaea; color: var(--red); }
    .card-box { max-width: 760px; margin-bottom: 16px; }
    .card-box h3 { margin-top: 6px; font-family: Inter, sans-serif; font-size: 1.02rem; }
    .pause p { color: var(--muted); font-size: .9rem; }
    .pause .btn { justify-self: start; }
    .day { display: grid; grid-template-columns: 1fr 130px 130px; gap: 10px; align-items: center; }
    .day.off .check { color: var(--muted); }
    .line { display: grid; grid-template-columns: 1fr 120px 120px auto; gap: 8px; }
    .line.two { grid-template-columns: 170px 1fr auto; }
    .hint { color: var(--muted); }
    @media (max-width: 600px) { .day, .line, .line.two { grid-template-columns: 1fr 1fr; } }
  `,
})
export class Hours {
  private readonly data = inject(AdminData);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private readonly now = signal(new Date());
  protected readonly dayName = (d: number) => DAY_NAMES[d];

  /** Copies modifiables, renouvelées quand Firestore change */
  protected readonly schedule = linkedSignal<DaySchedule[]>(() =>
    WEEK_ORDER.map(d => structuredClone(this.data.ordering().schedule.find(x => x.day === d)!)));
  protected readonly slots = linkedSignal<ClosedSlot[]>(() => structuredClone(this.data.ordering().closedSlots));
  protected readonly days = linkedSignal<ClosedDay[]>(() => structuredClone(this.data.ordering().closedDays));
  protected readonly paused = computed(() => this.data.ordering().ordersPaused);
  protected readonly pauseReason = linkedSignal(() => this.data.ordering().pauseReason);

  protected readonly state = computed(() => orderingState(this.data.ordering(), this.now()));

  protected readonly statusText = computed(() => {
    const s = this.state();
    if (s.open) return 'Le site accepte les commandes en ce moment.';
    if (s.reason === 'paused') return s.note || 'Fermeture manuelle : à rouvrir ici.';
    const back = s.reopens ? `Reprise le ${s.reopens.date} à ${s.reopens.time}.` : '';
    return [s.note, back].filter(Boolean).join(' · ');
  });

  private async patch(data: Partial<OrderingRules>, message: string) {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.data.saveOrdering(data);
      this.now.set(new Date());
      this.data.notify(message);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected togglePause() {
    const paused = !this.paused();
    return this.patch(
      { ordersPaused: paused, pauseReason: paused ? this.pauseReason().trim() : '' },
      paused ? 'Commandes fermées' : 'Commandes rouvertes',
    );
  }

  protected addSlot() {
    this.slots.update(l => [...l, { date: '', from: '06:00', to: '09:00' }]);
  }

  protected removeSlot(i: number) {
    this.slots.update(l => l.filter((_, n) => n !== i));
  }

  protected addDay() {
    this.days.update(l => [...l, { date: '', reason: '' }]);
  }

  protected removeDay(i: number) {
    this.days.update(l => l.filter((_, n) => n !== i));
  }

  protected save() {
    const invalid = this.schedule().some(d => d.open && d.from >= d.to) || this.slots().some(s => s.from >= s.to);
    if (invalid) {
      this.error.set("L'heure de fin doit être après l'heure de début.");
      return;
    }
    return this.patch(
      { schedule: this.schedule(), closedSlots: this.slots(), closedDays: this.days().filter(d => d.date) },
      'Horaires enregistrés',
    );
  }
}
