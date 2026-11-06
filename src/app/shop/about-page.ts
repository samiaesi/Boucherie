import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Certificate, ENGAGEMENT_KINDS, Engagement, validCertificates } from '../core/about';
import { I18n } from '../core/i18n';
import { Shop } from '../core/shop';
import { localDay } from '../core/stats';
import { Reveal } from './reveal';

@Component({
  selector: 'app-about-page',
  imports: [RouterLink, Reveal],
  template: `
    <section class="page-head"><div class="wrap"><h1>{{ i18n.t('aboutNav') }}</h1><p>{{ i18n.pick(shop.settings(), 'address') }}</p></div></section>

    @if (photos().length) {
      <section class="about-block">
        <div class="wrap">
          <h2>{{ i18n.t('aboutShop') }}</h2>
          <div class="about-gallery">
            @for (p of photos(); track p; let i = $index) {
              <button class="about-shot" appReveal [revealDelay]="i * 70" [attr.aria-label]="i18n.t('aboutShop')" (click)="zoom.set(p)"><img [src]="p" alt="" loading="lazy"></button>
            }
          </div>
        </div>
      </section>
    }

    @if (engagements().length) {
      <section class="about-block soft">
        <div class="wrap">
          <h2>{{ i18n.t('aboutCommit') }}</h2>
          <div class="about-cards">
            @for (e of engagements(); track $index; let i = $index) {
              <article class="about-card" appReveal [revealDelay]="i * 70">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="kind(e).icon" /></svg>
                <small>{{ i18n.lang() === 'ar' ? kind(e).ar : kind(e).fr }}</small>
                <h3>{{ i18n.pick(e, 'title') }}</h3>
                <p>{{ i18n.pick(e, 'text') }}</p>
              </article>
            }
          </div>
        </div>
      </section>
    }

    @if (certificates().length) {
      <section class="about-block">
        <div class="wrap">
          <h2>{{ i18n.t('aboutCertificates') }}</h2>
          <div class="about-cards">
            @for (c of certificates(); track c.id; let i = $index) {
              <button class="about-cert" appReveal [revealDelay]="i * 70" (click)="zoom.set(c.image)">
                <img [src]="c.image" alt="" loading="lazy">
                <b>{{ i18n.pick(c, 'name') }}</b>
                <small>{{ c.issuer }}@if (c.number) { · {{ c.number }} }</small>
              </button>
            }
          </div>
        </div>
      </section>
    }

    @if (ready() && !photos().length && !engagements().length && !certificates().length) {
      <section class="about-block"><div class="wrap"><p class="empty">{{ i18n.t('aboutEmpty') }}</p><a routerLink="/boutique" class="btn btn-red">{{ i18n.t('seeAll') }}</a></div></section>
    }

    @if (zoom(); as src) {
      <button class="about-zoom" [attr.aria-label]="i18n.t('back')" (click)="zoom.set('')"><img [src]="src" alt=""></button>
    }
  `,
})
export class AboutPage implements OnInit {
  protected readonly i18n = inject(I18n);
  protected readonly shop = inject(Shop);
  protected readonly photos = signal<string[]>([]);
  private readonly allCertificates = signal<Certificate[]>([]);
  protected readonly ready = signal(false);
  protected readonly zoom = signal('');
  protected readonly engagements = computed(() => this.shop.about().engagements);
  protected readonly certificates = computed(() => validCertificates(this.allCertificates(), localDay(new Date())));

  async ngOnInit() {
    const media = await this.shop.loadAboutMedia();
    this.photos.set(media.photos);
    this.allCertificates.set(media.certificates);
    this.ready.set(true);
  }

  protected kind(e: Engagement) {
    return ENGAGEMENT_KINDS[e.kind];
  }
}
