import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Announcement, KIND_LABELS } from '../core/announcements';
import { Cart } from '../core/cart';
import { HERO_PHOTOS, Offer, formatNumber } from '../core/data';
import { I18n, TKey } from '../core/i18n';
import { IconPipe } from '../core/icon';
import { Shop } from '../core/shop';
import { Count, Tilt } from './effects';
import { ProductCard } from './product-card';
import { Reveal } from './reveal';

const SLIDE_MS = 6000;
const STEP_MS = 2200;

const SLIDES: { a: TKey; b: TKey; t: TKey; link: { cat?: string } }[] = [
  { a: 'slide1a', b: 'slide1b', t: 'slide1t', link: { cat: 'poulet' } },
  { a: 'slide2a', b: 'slide2b', t: 'slide2t', link: { cat: 'agneau' } },
  { a: 'slide3a', b: 'slide3b', t: 'slide3t', link: {} },
];

@Component({
  selector: 'app-home',
  imports: [RouterLink, IconPipe, ProductCard, Reveal, Count, Tilt],
  template: `
    <section class="hero" (mousemove)="parallax($event)">
      @for (img of heroImages(); track img; let i = $index) {
        <div class="hero-bg" [class.on]="i === slide()" [style.background-image]="'url(' + img + ')'"></div>
      }
      <div class="hero-shade"></div>
      <div class="wrap hero-grid">
        @for (s of [slides[slide()]]; track s.a) {
          <div class="slide">
            <span class="kicker">{{ i18n.t('heroEyebrow') }}</span>
            <h1>
              <span class="line">
                @for (w of words(i18n.t(s.a)); track $index) { <span class="word" [style.--i]="$index">{{ w }}&nbsp;</span> }
              </span>
              <em class="line">
                @for (w of words(i18n.t(s.b)); track $index) { <span class="word" [style.--i]="$index + 3">{{ w }}&nbsp;</span> }
              </em>
            </h1>
            <p>{{ i18n.t(s.t) }}</p>
            <div class="hero-pickup">🏪 {{ i18n.t(shop.pickupKey()) }}</div>
            <div class="hero-actions">
              <a routerLink="/boutique" [queryParams]="s.link" class="btn btn-red">{{ i18n.t('order') }}</a>
              <a routerLink="/boutique" class="btn btn-outline">{{ i18n.t('seeAll') }}</a>
            </div>
          </div>
        }
        <div class="hero-float" [style.transform]="floatMove()"><img src="logo.svg" alt=""></div>
      </div>
      <div class="dots wrap">
        @for (s of slides; track s.a; let i = $index) {
          <button [class.on]="i === slide()" (click)="goTo(i)" [attr.aria-label]="i + 1"><i></i></button>
        }
      </div>
    </section>

    <div class="marquee" aria-hidden="true">
      <div class="marquee-track">
        @for (n of [1, 2, 3, 4]; track n) {
          <span>{{ i18n.t(shop.pickupKey()) }}</span><span>{{ i18n.t('s1') }}</span><span>{{ i18n.t('s2') }}</span><span>{{ i18n.t('s3') }}</span><span>{{ i18n.t('slide3b') }}</span>
        }
      </div>
    </div>

    @if (shop.live().length) {
      <section class="today">
        <div class="wrap">
          <div class="section-head" appReveal><h2>{{ i18n.t('newsToday') }}</h2></div>
          <div class="today-grid">
            @for (a of shop.live(); track a.id; let i = $index) {
              <a class="today-card" routerLink="/boutique" appReveal [revealDelay]="i * 90">
                <span>{{ kind(a).icon }}</span>
                <div><small>{{ kind(a)[i18n.lang()] }}</small><b>{{ i18n.pick(a, 'title') }}</b><p>{{ i18n.pick(a, 'text') }}</p></div>
              </a>
            }
          </div>
        </div>
      </section>
    }

    <section class="cats">
      <div class="wrap">
        <div class="section-head" appReveal>
          <span class="kicker">{{ i18n.t('catEyebrow') }}</span>
          <h2>{{ i18n.t('catTitle') }}</h2>
        </div>
        <div class="bento">
          @for (c of shop.categories(); track c.id; let i = $index) {
            <a class="tile" routerLink="/boutique" [queryParams]="{ cat: c.id }" appReveal [revealDelay]="i * 70" appTilt>
              @if (c.image) {
                <img [src]="c.image" [alt]="i18n.pick(c, 'name')" loading="lazy">
              } @else {
                <span class="tile-icon" [innerHTML]="c.icon | icon"></span>
              }
              <div class="tile-text">
                <b>{{ i18n.pick(c, 'name') }}</b>
                <small>{{ countIn(c.id) }} {{ i18n.t('articles') }} →</small>
              </div>
            </a>
          }
        </div>
      </div>
    </section>

    <section class="stats">
      <div class="wrap stats-grid">
        <div appReveal><b><span [appCount]="100"></span>%</b><span>{{ i18n.t('s1') }}</span></div>
        <div appReveal [revealDelay]="100"><b [appCount]="shop.products().length"></b><span>{{ i18n.t('statCuts') }}</span></div>
        <div appReveal [revealDelay]="200"><b [appCount]="shop.categories().length"></b><span>{{ i18n.t('statCats') }}</span></div>
        <div appReveal [revealDelay]="300"><b [appCount]="250"></b><span>{{ i18n.t('statMin') }}</span></div>
      </div>
    </section>

    <section class="products">
      <div class="wrap">
        <div class="section-head" appReveal>
          <span class="kicker">{{ i18n.t('popularEyebrow') }}</span>
          <h2>{{ i18n.t('popularTitle') }}</h2>
        </div>
        <div class="grid">
          @for (p of featured(); track p.id; let i = $index) {
            <app-product-card [product]="p" appReveal [revealDelay]="(i % 4) * 90" />
          }
        </div>
        <div class="center"><a routerLink="/boutique" class="btn btn-red">{{ i18n.t('seeAll') }}</a></div>
      </div>
    </section>

    <section class="steps">
      <div class="wrap">
        <div class="section-head light" appReveal>
          <h2>{{ i18n.t('stepsTitle') }}</h2>
          <p>{{ i18n.t(shop.pickupKey()) }}</p>
        </div>
        <div class="flow" (mouseleave)="resumeSteps()">
          <div class="flow-line" aria-hidden="true"><i [style.--fill]="(step() / (steps.length - 1)) * 100 + '%'"></i></div>
          @for (s of steps; track s.t; let i = $index) {
            <button class="step" [class.on]="i === step()" [class.past]="i < step()" appReveal [revealDelay]="i * 120"
                    (mouseenter)="holdStep(i)" (focus)="holdStep(i)" (click)="holdStep(i)">
              <span class="step-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="s.icon" /></svg>
                <em>{{ i + 1 }}</em>
              </span>
              <b>{{ i18n.t(s.t) }}</b>
              <p>{{ i18n.t(s.d === 'step4' && shop.settings().deliveryEnabled ? 'stepBoth' : s.d) }}</p>
            </button>
          }
        </div>
      </div>
    </section>

    <section id="formules" class="offers-sec">
      <div class="wrap">
        <div class="section-head" appReveal>
          <span class="kicker">{{ i18n.t('offEyebrow') }}</span>
          <h2>{{ i18n.t('offTitle') }}</h2>
          <p>{{ i18n.t('offText') }}</p>
        </div>
        <div class="offers">
          @for (o of shop.offers(); track o.id; let i = $index) {
            <div class="offer" [class.featured]="o.featured" appReveal [revealDelay]="i * 100" appTilt>
              @if (o.featured) { <span class="tag">{{ i18n.t('popular') }}</span> }
              <h3>{{ i18n.pick(o, 'name') }}</h3>
              <div class="price">{{ num(o.price) }} <span>{{ i18n.t('currency') }}</span> <small>{{ i18n.pick(o, 'unit') }}</small></div>
              <ul>
                @for (item of items(o); track $index) { <li>{{ item }}</li> }
              </ul>
              <button class="btn" [class.btn-red]="!o.featured" [class.btn-white]="o.featured" (click)="addOffer(o)">{{ i18n.t('addCart') }}</button>
            </div>
          }
        </div>
      </div>
    </section>

    <section class="aid">
      <div class="wrap aid-inner" appReveal>
        <span class="aid-icon" [innerHTML]="'agneau' | icon"></span>
        <div>
          <h3>{{ i18n.t('aidTitle') }}</h3>
          <p>{{ i18n.t('aidText') }}</p>
        </div>
        <button class="btn btn-white" (click)="addAid()">{{ i18n.t('aidCta') }}</button>
      </div>
    </section>

    <section id="engagement" class="about">
      <div class="wrap about-grid">
        <div class="about-visual" appReveal>
          @if (shop.settings().aboutImage) {
            <img [src]="shop.settings().aboutImage" alt="">
          } @else {
            <div class="about-placeholder"><img src="logo.svg" alt=""></div>
          }
          <div class="about-stamp"><b>100%</b>{{ i18n.t('s1') }}</div>
        </div>
        <div appReveal [revealDelay]="150">
          <span class="kicker">{{ i18n.t('aboutEyebrow') }}</span>
          <h2>{{ i18n.t('aboutTitle') }}</h2>
          <p class="lead">{{ i18n.t('aboutP1') }}</p>
          <div class="why">
            @for (w of why; track w.t) {
              <div class="why-item">
                <span class="why-icon">✓</span>
                <div><b>{{ i18n.t(w.t) }}</b><p>{{ i18n.t(w.d) }}</p></div>
              </div>
            }
          </div>
        </div>
      </div>
    </section>

    <section id="contact" class="contact">
      <div class="wrap">
        <div class="section-head" appReveal>
          <span class="kicker">{{ i18n.t('cEyebrow') }}</span>
          <h2>{{ i18n.t('cTitle') }}</h2>
        </div>
        <div class="contact-grid" appReveal>
          <div class="info">
            <div class="info-block"><span class="info-icon">📍</span><div><h3>{{ i18n.t('addrT') }}</h3><p>{{ i18n.pick(shop.settings(), 'address') }}</p><a class="map-link" [href]="shop.settings().mapLink" target="_blank" rel="noopener">{{ i18n.t('mapLink') }}</a></div></div>
            <div class="info-block"><span class="info-icon">📞</span><div><h3>{{ i18n.t('telT') }}</h3><p dir="ltr">{{ shop.settings().phone }}</p></div></div>
            <div class="info-block">
              <span class="info-icon">🕒</span>
              <div class="grow">
                <h3>{{ i18n.t('hoursT') }}</h3>
                <table class="hours">
                  @for (h of hours(); track h.days) {
                    <tr><td>{{ h.days }}</td><td>{{ h.hours }}</td></tr>
                  }
                </table>
              </div>
            </div>
          </div>
          <iframe class="map" [src]="mapUrl()" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Carte"></iframe>
        </div>
      </div>
    </section>
  `,
})
export class Home implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  protected readonly hours = computed(() => this.i18n.hoursLines(this.shop.orderingRules().schedule));
  protected readonly shop = inject(Shop);
  private readonly cart = inject(Cart);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly slides = SLIDES;
  protected readonly slide = signal(0);
  protected readonly floatMove = signal('');
  protected readonly num = formatNumber;
  protected readonly why: { t: TKey; d: TKey }[] = [
    { t: 'w1t', d: 'w1' }, { t: 'w2t', d: 'w2' }, { t: 'w3t', d: 'w3' }, { t: 'w4t', d: 'w4' },
  ];
  protected readonly steps: { t: TKey; d: TKey; icon: string }[] = [
    { t: 'step1t', d: 'step1', icon: 'M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2' },
    { t: 'step2t', d: 'step2', icon: 'M21 3L3 10.5l7 2.5 2.5 7zM10 13l5-5' },
    { t: 'step3t', d: 'step3', icon: 'M4 20l1.5-4A8 8 0 1 1 9 19zM9 12l2 2 4-4' },
    { t: 'step4t', d: 'step4', icon: 'M2 7h12v10H2zM14 10h4l4 4v3h-8zM6.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
  ];
  /** Étape mise en avant : avance seule, s'arrête sur celle que le visiteur survole */
  protected readonly step = signal(0);
  private stepTimer?: ReturnType<typeof setInterval>;
  private timer?: ReturnType<typeof setInterval>;

  /** La photo choisie dans l'admin remplace la première image de la bannière. */
  protected readonly heroImages = computed(() => {
    const own = this.shop.settings().heroImage;
    return own ? [own, ...HERO_PHOTOS.slice(1)] : HERO_PHOTOS;
  });

  protected readonly featured = computed(() => {
    const all = this.shop.products();
    const picked = all.filter(p => p.featured);
    return (picked.length ? picked : all).slice(0, 8);
  });

  protected readonly mapUrl = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(
    `https://maps.google.com/maps?q=${encodeURIComponent(this.shop.settings().mapPosition)}&z=17&output=embed`,
  ));

  ngOnInit() {
    this.startTimer();
    this.resumeSteps();
  }

  ngOnDestroy() {
    clearInterval(this.timer);
    clearInterval(this.stepTimer);
  }

  protected resumeSteps() {
    clearInterval(this.stepTimer);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.stepTimer = setInterval(() => this.step.update(i => (i + 1) % this.steps.length), STEP_MS);
  }

  protected holdStep(i: number) {
    clearInterval(this.stepTimer);
    this.step.set(i);
  }

  private startTimer() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.slide.update(i => (i + 1) % SLIDES.length), SLIDE_MS);
  }

  protected goTo(i: number) {
    this.slide.set(i);
    this.startTimer();
  }

  protected words(text: string) {
    return text.split(' ');
  }

  protected parallax(e: MouseEvent) {
    const x = e.clientX / window.innerWidth - 0.5, y = e.clientY / window.innerHeight - 0.5;
    this.floatMove.set(`translate(${x * -28}px, ${y * -28}px)`);
  }

  protected countIn(category: string) {
    return this.shop.products().filter(p => p.category === category).length;
  }

  protected kind(a: Announcement) {
    return KIND_LABELS[a.kind];
  }

  protected items(o: Offer) {
    const list = this.i18n.lang() === 'ar' ? o.items_ar : o.items_fr;
    return list?.length ? list : o.items_fr;
  }

  protected addOffer(o: Offer) {
    this.cart.add({ productId: `offre-${o.id}`, name_fr: o.name_fr, name_ar: o.name_ar, unit: 'piece', price: o.price, qty: 1 }, this.i18n.pick(o, 'name'));
  }

  protected addAid() {
    this.cart.add({ productId: 'mouton-aid', name_fr: "Mouton de l'Aïd", name_ar: 'أضحية العيد', unit: 'order', price: 0, qty: 1 }, this.i18n.t('fAid'));
  }
}
