import { Component, ElementRef, OnDestroy, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Announcement, KIND_LABELS } from '../core/announcements';
import { Cart, lineTotal } from '../core/cart';
import { I18n } from '../core/i18n';
import { Logo } from '../core/logo';
import { Shop } from '../core/shop';
import { ClosedNotice } from './closed-notice';
import { InstallApp } from './install-app';

const SEEN_KEY = 'newsSeen';

function savedSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

@Component({
  selector: 'app-shop-layout',
  imports: [ClosedNotice, InstallApp, Logo, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="progress" #progress></div>
    <header #header>
      <div class="wrap nav">
        <a routerLink="/" class="logo">
          <app-logo />
          <span><b>{{ i18n.pick(shop.settings(), 'name') }}</b><small>{{ i18n.t('brandSub') }}</small></span>
        </a>
        <nav class="menu" [class.open]="menuOpen()" (click)="menuOpen.set(false)">
          <a routerLink="/" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }">{{ i18n.t('navHome') }}</a>
          <a routerLink="/boutique" routerLinkActive="on">{{ i18n.t('navShop') }}</a>
          <a routerLink="/" fragment="formules">{{ i18n.t('navOffers') }}</a>
          <a routerLink="/" fragment="contact">{{ i18n.t('navContact') }}</a>
          @if (shop.lastOrder()) { <a [routerLink]="['/suivi', shop.lastOrder()]">{{ i18n.t('trackLink') }}</a> }
        </nav>
        <div class="nav-actions">
          <button class="lang" (click)="i18n.toggle()">{{ i18n.t('langBtn') }}</button>
          <div class="news-wrap">
            <button class="news-btn" [class.ring]="unseen().length" (click)="toggleNews()" [attr.aria-label]="i18n.t('newsTitle')">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10a6 6 0 1 1 12 0c0 5 2 6 2 7H4c0-1 2-2 2-7zM10 20a2 2 0 0 0 4 0" /></svg>@if (unseen().length) { <b>{{ unseen().length }}</b> }
            </button>
            @if (newsOpen()) {
              <div class="news-panel">
                <h3>{{ i18n.t('newsTitle') }}</h3>
                @for (a of shop.live(); track a.id) {
                  <a class="news-item" routerLink="/boutique" (click)="newsOpen.set(false)">
                    <span>{{ kind(a).icon }}</span>
                    <div><small>{{ kindLabel(a) }}</small><b>{{ i18n.pick(a, 'title') }}</b><p>{{ i18n.pick(a, 'text') }}</p></div>
                  </a>
                } @empty { <p class="news-empty">{{ i18n.t('newsEmpty') }}</p> }
              </div>
            }
          </div>
          <button class="cart-btn" (click)="cart.open.set(true)" [attr.aria-label]="i18n.t('cart')">
            @for (n of [cart.bump()]; track n) { <span class="cart-ico"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l1 12H5zM9 8V7a3 3 0 0 1 6 0v1" /></svg></span> }
            <span class="hide-sm">{{ i18n.t('cart') }}</span>
            @if (cart.count()) { <b>{{ cart.count() }}</b> }
          </button>
          <button class="burger" aria-label="Menu" (click)="menuOpen.set(!menuOpen())"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
        </div>
      </div>
    </header>

    <app-closed-notice />
    <main><router-outlet /></main>
    <app-install />

    <footer>
      <div class="wrap footer-grid">
        <div>
          <a routerLink="/" class="logo light">
            <app-logo />
            <span><b>{{ i18n.pick(shop.settings(), 'name') }}</b><small>{{ i18n.t('brandSub') }}</small></span>
          </a>
          <p>{{ i18n.t('footerText') }}</p>
        </div>
        <div>
          <h4>{{ i18n.t('navShop') }}</h4>
          @for (c of shop.categories(); track c.id) {
            <a routerLink="/boutique" [queryParams]="{ cat: c.id }">{{ i18n.pick(c, 'name') }}</a>
          }
        </div>
        <div>
          <h4>{{ i18n.t('navContact') }}</h4>
          <p>{{ i18n.pick(shop.settings(), 'address') }}</p>
          <a [href]="shop.settings().mapLink" target="_blank" rel="noopener">{{ i18n.t('mapLink') }}</a>
          <p dir="ltr"><a [href]="phoneHref()">{{ shop.settings().phone }}</a></p>
        </div>
      </div>
      <div class="copy"><div class="wrap">© {{ year }} {{ i18n.pick(shop.settings(), 'name') }} · {{ shop.settings().company }} · {{ i18n.t('footer') }} · {{ i18n.t('madeBy') }} <bdi dir="ltr">Medine Samia</bdi></div></div>
    </footer>

    <!-- Panier -->
    <div class="scrim" [class.show]="cart.open()" (click)="cart.open.set(false)"></div>
    <aside class="drawer" [class.show]="cart.open()" [attr.aria-hidden]="!cart.open()">
      <div class="drawer-head">
        <h3>{{ i18n.t('cart') }} ({{ cart.count() }})</h3>
        <button (click)="cart.open.set(false)" aria-label="Fermer">✕</button>
      </div>
      <div class="drawer-body">
        @for (l of cart.lines(); track l.key) {
          <div class="line">
            <div class="line-info">
              <b>{{ i18n.pick(l, 'name') }}</b>
              <small>
                @if (l.grams) { {{ i18n.weight(l.grams) }} }
                @if (l.option_fr) { · {{ i18n.pick(l, 'option') }} }
              </small>
              <div class="qty small">
                <button (click)="cart.setQty(l.key, l.qty - 1)" aria-label="-">−</button>
                <span>{{ l.qty }}</span>
                <button (click)="cart.setQty(l.key, l.qty + 1)" aria-label="+">+</button>
              </div>
            </div>
            <div class="line-side">
              <b>{{ l.unit === 'order' ? i18n.t('toConfirm') : i18n.money(lineTotal(l)) }}</b>
              <button class="link" (click)="cart.setQty(l.key, 0)">{{ i18n.t('remove') }}</button>
            </div>
          </div>
        } @empty {
          <p class="empty">{{ i18n.t('cartEmpty') }}</p>
          <a routerLink="/boutique" class="btn btn-red block" (click)="cart.open.set(false)">{{ i18n.t('seeAll') }}</a>
        }
      </div>
      @if (cart.lines().length) {
        <div class="drawer-foot">
          <div class="sum"><span>{{ i18n.t('total') }}</span><b>{{ i18n.money(cart.total()) }}</b></div>
          <p class="pickup">🏪 {{ i18n.t(shop.pickupKey()) }}</p>
          <p class="note">{{ i18n.t('estimate') }}</p>
          <a routerLink="/commande" class="btn btn-red block" (click)="cart.open.set(false)">{{ i18n.t('checkout') }}</a>
          <button class="btn-text" (click)="cart.open.set(false)">{{ i18n.t('keepShopping') }}</button>
        </div>
      }
    </aside>

    <!-- Nouvelle annonce : s'affiche une fois pour ce visiteur -->
    @if (popup(); as a) {
      <div class="news-pop" role="status">
        <button (click)="closePopup(a)" aria-label="Fermer">✕</button>
        <span>{{ kind(a).icon }}</span>
        <div>
          <small>{{ kindLabel(a) }}</small>
          <b>{{ i18n.pick(a, 'title') }}</b>
          <p>{{ i18n.pick(a, 'text') }}</p>
          <a routerLink="/boutique" class="btn btn-red" (click)="closePopup(a)">{{ i18n.t('order') }}</a>
        </div>
      </div>
    }

    <!-- Annonce d'ajout au panier -->
    <div class="added" [class.show]="cart.justAdded()" role="status">
      <span>✓</span>
      <div><b>{{ i18n.t('added') }}</b><small>{{ cart.justAdded() }}</small></div>
      <button (click)="cart.open.set(true)">{{ i18n.t('stickyCart') }}</button>
    </div>

    <div class="added warned" [class.show]="cart.warning()" role="alert">
      <span>!</span>
      <div><b>{{ i18n.t('soldOut') }}</b><small>{{ cart.warning() }}</small></div>
    </div>

    <!-- Panier toujours accessible sur mobile -->
    @if (cart.count() && !cart.open()) {
      <button class="sticky-cart" (click)="cart.open.set(true)">
        <span>🛒 {{ i18n.t('stickyCart') }} ({{ cart.count() }})</span><b>{{ i18n.money(cart.total()) }}</b>
      </button>
    }

    <a class="wa-float" [href]="waHref()" target="_blank" [attr.aria-label]="i18n.t('waFloat')">
      <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2.1.7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3z"/></svg>
    </a>
  `,
})
export class ShopLayout implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  protected readonly shop = inject(Shop);
  protected readonly cart = inject(Cart);
  protected readonly menuOpen = signal(false);
  protected readonly year = new Date().getFullYear();
  protected readonly lineTotal = lineTotal;
  protected readonly newsOpen = signal(false);
  private readonly seen = signal(savedSeen());
  protected readonly unseen = computed(() => this.shop.live().filter(a => !this.seen().has(a.id)));
  private readonly closed = signal(new Set<string>());
  protected readonly popup = computed(() => this.unseen().find(a => !this.closed().has(a.id)));
  private readonly progress = viewChild.required<ElementRef<HTMLElement>>('progress');
  private readonly header = viewChild.required<ElementRef<HTMLElement>>('header');

  // Directement sur le DOM : inutile de redessiner la page à chaque pixel de défilement
  private readonly onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.progress().nativeElement.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    this.header().nativeElement.classList.toggle('small', window.scrollY > 60);
  };

  constructor() {
    effect(() => {
      document.title = `${this.i18n.pick(this.shop.settings(), 'name')} — ${this.i18n.t('halal')}`;
      // En revenant de l'admin (toujours en français), on rétablit le sens de lecture
      document.documentElement.dir = this.i18n.lang() === 'ar' ? 'rtl' : 'ltr';
    });
  }

  ngOnInit() {
    this.shop.load();
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }

  ngOnDestroy() {
    window.removeEventListener('scroll', this.onScroll);
  }

  protected kind(a: Announcement) {
    return KIND_LABELS[a.kind];
  }

  protected kindLabel(a: Announcement) {
    return KIND_LABELS[a.kind][this.i18n.lang()];
  }

  private markSeen(ids: string[]) {
    const all = new Set([...this.seen(), ...ids]);
    this.seen.set(all);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...all])); } catch {}
  }

  protected toggleNews() {
    this.newsOpen.update(open => !open);
    this.markSeen(this.shop.live().map(a => a.id));
  }

  protected closePopup(a: Announcement) {
    this.closed.update(all => new Set(all).add(a.id));
    this.markSeen([a.id]);
  }

  protected phoneHref() {
    return 'tel:' + this.shop.settings().phone.replace(/\s/g, '');
  }

  protected waHref() {
    return `https://wa.me/${this.shop.settings().whatsapp}`;
  }
}
