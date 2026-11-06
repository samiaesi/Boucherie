import { openCampaigns } from '../core/campaigns';
import { algeriaClock } from '../core/ordering';
import { Favorites } from '../core/favorites';
import { Suggest } from './suggest';
import { Component, ElementRef, OnDestroy, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
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
  imports: [Suggest, ClosedNotice, InstallApp, Logo, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="progress" #progress></div>
    <header #header>
      <div class="wrap nav">
        <a routerLink="/" class="logo">
          <app-logo />
          <span><b>{{ i18n.pick(shop.settings(), 'name') }}</b><small>{{ i18n.t('brandSub') }}</small></span>
        </a>
        <nav class="menu" #menu [class.open]="menuOpen()" (click)="menuOpen.set(false)" (mouseover)="hoverMenu($event)" (mouseleave)="movePill()">
          <span class="menu-pill" #pill aria-hidden="true"></span>
          <a routerLink="/" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }">{{ i18n.t('navHome') }}</a>
          <a routerLink="/boutique" routerLinkActive="on">{{ i18n.t('navShop') }}</a>
          <a routerLink="/" fragment="formules">{{ i18n.t('navOffers') }}</a>
          @if (shop.category('speciales')) {
            <a routerLink="/boutique" [queryParams]="{ cat: 'speciales' }">{{ i18n.t('specialOrder') }}</a>
          }
          @if (reservation()) { <a class="menu-res" routerLink="/reservation" routerLinkActive="on">{{ i18n.t('resTitle') }}</a> }
          <a class="menu-fav" routerLink="/favoris" routerLinkActive="on">{{ i18n.t('favNav') }}</a>
          <a class="menu-plan" routerLink="/mon-menu" routerLinkActive="on">{{ i18n.t('menuNav') }}</a>
          @if (shop.hasAbout()) { <a routerLink="/notre-boucherie" routerLinkActive="on">{{ i18n.t('aboutNav') }}</a> }
          <a routerLink="/" fragment="contact">{{ i18n.t('navContact') }}</a>
          @if (shop.lastOrder() && !reservation()) { <a class="menu-track" [routerLink]="['/suivi', shop.lastOrder()]">{{ i18n.t('trackLink') }}</a> }
        </nav>
        <div class="nav-actions">
          <button class="lang" (click)="i18n.toggle(); moveAfterLang()">{{ i18n.t('langBtn') }}</button>
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
          <a class="fav-link" routerLink="/favoris" [attr.aria-label]="i18n.t('favNav')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.3 3.8 4.5 6.9 4.5c2 0 3.7 1.1 5.1 3 1.4-1.9 3.1-3 5.1-3 3.1 0 5.4 2.8 4.2 6.3C19.5 15.4 12 20 12 20z" /></svg>@if (favorites.count()) { <b>{{ favorites.count() }}</b> }</a>
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
          @if (shop.settings().loyaltyEnabled) { <a routerLink="/fidelite">{{ i18n.t('loyaltyNav') }}</a> }
          <a routerLink="/favoris">{{ i18n.t('favNav') }}</a>
          @if (reservation()) { <a routerLink="/reservation">{{ i18n.t('resTitle') }}</a> }
          @if (shop.lastOrder()) { <a [routerLink]="['/suivi', shop.lastOrder()]">{{ i18n.t('trackLink') }}</a> }
          <p dir="ltr"><a [href]="phoneHref()">{{ shop.settings().phone }}</a></p>
        </div>
      </div>
      <div class="copy"><div class="wrap">© {{ year }} {{ i18n.pick(shop.settings(), 'name') }} · {{ shop.settings().company }} · {{ i18n.t('footer') }}<br>© {{ year }} {{ i18n.t('madeBy') }} <bdi dir="ltr">Samia Medine</bdi> · {{ i18n.t('rights') }}</div></div>
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
                @if (l.origin) { · {{ i18n.country(l.origin) }} }
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
          @if (cart.lastBasket().length) {
            <button class="btn btn-white block reorder-btn" (click)="reorder()">{{ i18n.t('reorder') }}</button>
          }
          <a routerLink="/boutique" class="btn btn-red block" (click)="cart.open.set(false)">{{ i18n.t('seeAll') }}</a>
        }
        <app-suggest />
      </div>
      @if (cart.lines().length) {
        <div class="drawer-foot">
          <div class="sum"><span>{{ i18n.t('total') }}</span><b>{{ i18n.total(cart.total(), cart.pending()) }}</b></div>
          <p class="serve-line"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 7h12v10H2zM14 10h4l4 4v3h-8zM6.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg>{{ i18n.t(shop.pickupKey()) }}</p>
          <p class="note">{{ i18n.t(cart.pending() ? 'pendingPrice' : 'estimate') }}</p>
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
        <span>🛒 {{ i18n.t('stickyCart') }} ({{ cart.count() }})</span><b>{{ i18n.total(cart.total(), cart.pending()) }}</b>
      </button>
    }

    <a class="wa-float" [href]="waHref()" target="_blank" [attr.aria-label]="i18n.t('waFloat')">
      <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2.1.7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3z"/></svg>
    </a>
  `,
})
export class ShopLayout implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  protected readonly favorites = inject(Favorites);
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
  private readonly menu = viewChild.required<ElementRef<HTMLElement>>('menu');
  private readonly pill = viewChild.required<ElementRef<HTMLElement>>('pill');
  private readonly router = inject(Router);
  private navigation?: Subscription;
  private readonly onResize = () => this.movePill();
  /** Changer de langue change la largeur des liens : la pastille se replace. */
  private readonly pillOnLang = effect(() => {
    this.i18n.lang();
    setTimeout(() => this.movePill(), 80);
  });

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
    window.addEventListener('resize', this.onResize);
    this.navigation = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => setTimeout(this.onResize));
    document.fonts?.ready.then(this.onResize);
    setTimeout(this.onResize);
  }

  /** La pastille glisse jusqu'au lien survolé, puis revient sur la page ouverte. */
  protected readonly reservation = computed(() => openCampaigns(this.shop.campaigns(), algeriaClock(this.shop.clock()).date)[0]);

  protected reorder() {
    this.shop.reorder(this.cart, this.i18n);
  }

  protected movePill(link?: HTMLElement | null) {
    const target = link ?? this.menu().nativeElement.querySelector<HTMLElement>('a.on');
    const pill = this.pill().nativeElement;
    pill.style.opacity = target ? '1' : '0';
    if (!target) return;
    pill.style.width = `${target.offsetWidth}px`;
    pill.style.transform = `translateX(${target.offsetLeft}px)`;
  }

  protected moveAfterLang() {
    setTimeout(this.onResize);
  }

  protected hoverMenu(e: Event) {
    const link = (e.target as HTMLElement).closest('a');
    if (link) this.movePill(link);
  }

  ngOnDestroy() {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onResize);
    this.navigation?.unsubscribe();
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
