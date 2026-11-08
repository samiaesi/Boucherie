import { shopOrigin } from './admin-app';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Announcement, AnnouncementKind, KIND_LABELS, Subscriber, announcementMessage, liveAnnouncements, subscribers } from '../core/announcements';
import { localDay } from '../core/stats';
import { AdminData } from './admin-data';

const blank = (): Omit<Announcement, 'id'> => {
  const today = localDay(new Date());
  return { kind: 'arrivage', title_fr: '', title_ar: '', text_fr: '', text_ar: '', start: today, end: today };
};

@Component({
  selector: 'app-announcements',
  imports: [FormsModule],
  template: `
    <div class="head"><h2>Annonces clients</h2></div>

    <form class="card-box" #f="ngForm" (ngSubmit)="save(f)">
      <div class="grid2">
        <label>Type
          <select name="kind" [(ngModel)]="draft.kind">
            @for (k of kinds; track k[0]) { <option [value]="k[0]">{{ k[1].icon }} {{ k[1].fr }}</option> }
          </select>
        </label>
        <span></span>
        <label>Titre (français)<input name="title_fr" required placeholder="Agneau frais arrivé ce matin" [(ngModel)]="draft.title_fr"></label>
        <label>Titre (arabe)<input name="title_ar" dir="rtl" required [(ngModel)]="draft.title_ar"></label>
        <label>Détail (français)<textarea name="text_fr" rows="2" [(ngModel)]="draft.text_fr"></textarea></label>
        <label>Détail (arabe)<textarea name="text_ar" dir="rtl" rows="2" [(ngModel)]="draft.text_ar"></textarea></label>
        <label>Afficher du<input name="start" type="date" required [(ngModel)]="draft.start"></label>
        <label>Au<input name="end" type="date" required [min]="draft.start" [(ngModel)]="draft.end"></label>
      </div>
      @if (error()) { <div class="msg">{{ error() }}</div> }
      <div class="form-actions"><button class="btn" type="submit" [disabled]="f.invalid || busy()">Publier sur le site</button></div>
    </form>

    <h3 class="section">Annonces</h3>
    <div class="items">
      @for (a of list(); track a.id) {
        <div class="item" [class.off]="!isLive(a)">
          <div class="info">
            <b>{{ kindOf(a).icon }} {{ a.title_fr }} @if (isLive(a)) { <span class="pill">En ligne</span> }</b>
            <small>{{ kindOf(a).fr }} · du {{ a.start }} au {{ a.end }}</small>
          </div>
          <button class="btn light small" [class.wa]="selected() === a.id" (click)="selected.set(a.id)">Envoyer aux clients</button>
          <button class="btn danger small" (click)="remove(a)">✕</button>
        </div>
      } @empty {
        @if (loaded()) { <div class="empty">Aucune annonce pour le moment.</div> }
      }
    </div>

    @if (current(); as a) {
      <h3 class="section">Envoi WhatsApp : {{ a.title_fr }}</h3>
      <p class="hint">
        Seuls les clients qui ont coché « recevoir les offres » apparaissent ici.
        Chaque bouton ouvre WhatsApp avec le message prêt : il reste à appuyer sur Envoyer.
      </p>
      <div class="share">
        <button class="btn wa" (click)="copy(a)">{{ copied() ? 'Message copié ✓' : 'Copier le message (français et arabe)' }}</button>
        <small>À coller dans une liste de diffusion ou une chaîne WhatsApp, pour écrire à tout le monde d'un coup.</small>
      </div>
      <div class="items">
        @for (c of subs(); track c.tel) {
          <div class="item">
            <div class="info"><b>{{ c.name }}</b><small>{{ c.tel }}</small></div>
            <a class="btn small" [class.wa]="!sent().has(c.tel)" [class.light]="sent().has(c.tel)" target="_blank"
               [href]="waLink(a, c)" (click)="markSent(c)">{{ sent().has(c.tel) ? 'Ouvert ✓' : 'Envoyer' }}</a>
          </div>
        } @empty {
          <div class="empty">Aucun client inscrit pour le moment.</div>
        }
      </div>
    }
  `,
  styles: `
    .section { margin: 22px 0 10px; font-family: Inter, sans-serif; font-size: 1.05rem; }
    .share { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .share small { color: var(--muted); }
    .hint { margin-bottom: 10px; color: var(--muted); font-size: .88rem; }
  `,
})
export class Announcements implements OnInit {
  private readonly data = inject(AdminData);
  protected readonly list = signal<Announcement[]>([]);
  protected readonly loaded = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly selected = signal('');
  protected readonly sent = signal(new Set<string>());
  protected readonly copied = signal(false);
  protected readonly kinds = Object.entries(KIND_LABELS) as [AnnouncementKind, (typeof KIND_LABELS)[AnnouncementKind]][];
  protected draft = blank();

  protected readonly subs = computed(() => subscribers(this.data.orders()));
  protected readonly current = computed(() => this.list().find(a => a.id === this.selected()));
  private readonly live = computed(() => liveAnnouncements(this.list(), localDay(new Date())));

  async ngOnInit() {
    await this.reload();
    this.loaded.set(true);
  }

  private async reload() {
    this.list.set(await this.data.listAnnouncements());
  }

  protected kindOf(a: Announcement) {
    return KIND_LABELS[a.kind];
  }

  protected isLive(a: Announcement) {
    return this.live().some(x => x.id === a.id);
  }

  protected async save(form: NgForm) {
    this.busy.set(true);
    this.error.set('');
    try {
      const id = await this.data.addAnnouncement(this.draft);
      this.data.notify('Annonce publiée sur le site');
      this.draft = blank();
      form.resetForm(blank());
      await this.reload();
      this.selected.set(id);
      this.sent.set(new Set());
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(a: Announcement) {
    if (!confirm(`Retirer l'annonce « ${a.title_fr} » ?`)) return;
    await this.data.removeAnnouncement(a.id);
    await this.reload();
  }

  protected waLink(a: Announcement, c: Subscriber) {
    const tel = c.tel.replace(/\D/g, '');
    const number = tel.startsWith('0') ? `213${tel.slice(1)}` : tel;
    const text = announcementMessage(a, c.lang, this.data.settings().name_fr, shopOrigin());
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  }

  /** Pour une liste de diffusion : les deux langues dans un seul message. */
  protected async copy(a: Announcement) {
    const shop = this.data.settings();
    const fr = announcementMessage(a, 'fr', shop.name_fr, '');
    const ar = announcementMessage(a, 'ar', shop.name_ar, shopOrigin());
    await navigator.clipboard.writeText(`${fr}\n\n${ar}`);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2500);
  }

  protected markSent(c: Subscriber) {
    this.sent.update(all => new Set(all).add(c.tel));
  }
}
