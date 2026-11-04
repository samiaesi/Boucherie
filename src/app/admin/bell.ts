import { Component, Injectable, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { AdminData } from './admin-data';
import { Auth } from './auth';
import { Notice, NoticeKind, buildNotices } from './notices';

const READ_KEY = 'noticesRead';
const CLOCK_MS = 60000;

function savedRead(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

@Injectable({ providedIn: 'root' })
export class Notifications implements OnDestroy {
  private readonly data = inject(AdminData);
  private readonly auth = inject(Auth);
  private readonly now = signal(new Date());
  private readonly online = signal(navigator.onLine);
  private readonly read = signal(savedRead());
  private seen: Set<string> | null = null;
  protected readonly canAsk = typeof Notification !== 'undefined';
  /** Autorisation des notifications du navigateur */
  readonly permission = signal(this.canAsk ? Notification.permission : 'denied');

  readonly items = computed(() => {
    const role = this.auth.role();
    return buildNotices({
      orders: this.data.orders(), products: this.data.products(), fridge: this.data.fridge(), settings: this.data.settings(), ordersPaused: this.data.ordering().ordersPaused,
      now: this.now(), online: this.online(), error: this.data.lastError(),
    }).filter(n => role === 'admin' || n.kind === 'order' || (n.kind === 'stock' && role === 'manager'));
  });
  readonly unread = computed(() => this.items().filter(n => !this.read().has(n.id)));

  private readonly clock = setInterval(() => this.now.set(new Date()), CLOCK_MS);
  private readonly onOnline = () => this.online.set(navigator.onLine);

  constructor() {
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOnline);
    effect(() => {
      const items = this.items();
      if (!this.data.ready()) return;
      untracked(() => this.alertNew(items));
    });
  }

  ngOnDestroy() {
    clearInterval(this.clock);
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOnline);
  }

  /** Alerte seulement ce qui vient d'apparaître, pas ce qui existait à l'ouverture. */
  private alertNew(items: Notice[]) {
    const first = this.seen === null;
    const fresh = first ? [] : items.filter(n => !this.seen!.has(n.id));
    this.seen = new Set(items.map(n => n.id));

    // Une cause disparue puis revenue (nouvelle rupture) doit redevenir non lue
    const kept = [...this.read()].filter(id => this.seen!.has(id));
    if (kept.length !== this.read().size) this.saveRead(new Set(kept));

    const urgent = fresh.filter(n => n.level !== 'info');
    if (!urgent.length) return;
    this.data.notify(urgent[0].title, 6000);
    this.beep();
    if (this.permission() === 'granted') {
      for (const n of urgent) new Notification(n.title, { body: n.text, icon: 'logo.svg', tag: n.id });
    }
  }

  private beep() {
    try {
      const audio = new AudioContext();
      const tone = audio.createOscillator();
      tone.connect(audio.destination);
      tone.frequency.value = 880;
      tone.start();
      tone.stop(audio.currentTime + 0.25);
    } catch {}
  }

  private saveRead(ids: Set<string>) {
    this.read.set(ids);
    try { localStorage.setItem(READ_KEY, JSON.stringify([...ids])); } catch {}
  }

  isRead(id: string) {
    return this.read().has(id);
  }

  markRead(id: string) {
    this.saveRead(new Set([...this.read(), id]));
  }

  markAllRead() {
    this.saveRead(new Set(this.items().map(n => n.id)));
  }

  async askPermission() {
    this.permission.set(await Notification.requestPermission());
  }
}

@Component({
  selector: 'app-bell',
  template: `
    <div class="bell-wrap">
      <button class="bell" [class.ring]="notes.unread().length" (click)="open.set(!open())" aria-label="Notifications">
        🔔 @if (notes.unread().length) { <span class="badge">{{ notes.unread().length }}</span> }
      </button>
      @if (open()) {
        <div class="bell-scrim" (click)="open.set(false)"></div>
        <div class="panel">
          <div class="panel-head">
            <b>Notifications</b>
            <button class="link" [disabled]="!notes.unread().length" (click)="notes.markAllRead()">Tout marquer comme lu</button>
          </div>
          <div class="panel-tabs">
            @for (t of tabs; track t[0]) {
              <button class="chip" [class.active]="t[0] === tab()" (click)="tab.set(t[0])">{{ t[1] }} ({{ count(t[0]) }})</button>
            }
          </div>
          @if (notes.permission() === 'default') {
            <button class="btn light small enable" (click)="notes.askPermission()">Activer les alertes sur cet ordinateur</button>
          }
          <div class="panel-list">
            @for (n of shown(); track n.id) {
              <button class="note" [class]="n.level" [class.unread]="!notes.isRead(n.id)" (click)="go(n)">
                <b>{{ n.title }}</b>
                <small>{{ n.text }}</small>
              </button>
            } @empty {
              <p class="none">Rien à signaler.</p>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .bell-wrap { position: relative; }
    .bell { position: relative; width: 40px; height: 40px; border: 1px solid var(--line); border-radius: 50%; background: #fff; font-size: 1.05rem; }
    .bell.ring { animation: ring 1.6s ease-in-out 2; }
    @keyframes ring { 10%, 30% { transform: rotate(14deg); } 20%, 40% { transform: rotate(-14deg); } 50% { transform: none; } }
    .bell .badge { position: absolute; top: -5px; inset-inline-end: -6px; margin: 0; }
    .bell-scrim { position: fixed; inset: 0; z-index: 19; }
    .panel { position: absolute; top: 48px; inset-inline-end: 0; z-index: 20; width: min(380px, calc(100vw - 24px)); max-height: 70vh; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 14px; background: #fff; box-shadow: 0 20px 40px -18px rgba(35, 26, 23, .5); text-align: start; color: var(--ink); }
    .panel-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; }
    .link { border: 0; background: none; color: var(--bordeaux); font-size: .8rem; text-decoration: underline; }
    .link:disabled { opacity: .4; }
    .panel-tabs { display: flex; gap: 6px; padding: 0 14px 10px; flex-wrap: wrap; }
    .panel-tabs .chip { padding: 3px 10px; font-size: .75rem; }
    .enable { margin: 0 14px 10px; }
    .panel-list { overflow-y: auto; border-top: 1px solid var(--line); }
    .note { display: block; width: 100%; padding: 10px 14px; border: 0; border-bottom: 1px solid var(--line); border-inline-start: 4px solid var(--line); background: #fff; text-align: start; opacity: .6; }
    .note.unread { opacity: 1; background: #fffaf3; }
    .note.danger { border-inline-start-color: var(--red); }
    .note.warn { border-inline-start-color: var(--orange); }
    .note.info { border-inline-start-color: var(--blue); }
    .note b, .note small { display: block; }
    .note small { color: var(--muted); }
    .none { padding: 24px; text-align: center; color: var(--muted); }
  `,
})
export class Bell {
  protected readonly notes = inject(Notifications);
  private readonly router = inject(Router);
  protected readonly open = signal(false);
  protected readonly tab = signal<NoticeKind | 'all'>('all');
  protected readonly tabs: [NoticeKind | 'all', string][] = [['all', 'Tout'], ['order', 'Commandes'], ['stock', 'Stock'], ['system', 'Système']];

  protected readonly shown = computed(() => {
    const t = this.tab();
    return this.notes.items().filter(n => t === 'all' || n.kind === t);
  });

  protected count(kind: NoticeKind | 'all') {
    return this.notes.items().filter(n => kind === 'all' || n.kind === kind).length;
  }

  protected go(n: Notice) {
    this.notes.markRead(n.id);
    this.open.set(false);
    this.router.navigateByUrl(n.link);
  }
}
