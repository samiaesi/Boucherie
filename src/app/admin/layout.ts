import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminData } from './admin-data';
import { Auth } from './auth';
import { Bell } from './bell';
import { reportSeenToday } from './report';
import { ROLE_LABELS, canOpen, menuFor } from './roles';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Bell],
  template: `
    <div class="adm shell">
      <div class="side-scrim" [class.show]="menuOpen()" (click)="menuOpen.set(false)"></div>
      <aside class="side" [class.open]="menuOpen()">
        <div class="brand"><img src="logo.svg" alt=""> <span>Boucherie Hallem</span></div>
        <nav aria-label="Menu" (click)="menuOpen.set(false)">
          @for (g of menu(); track g.name) {
            <p class="group">{{ g.name }}</p>
            @for (p of g.pages; track p.path) {
              <a [routerLink]="p.path" routerLinkActive="active">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="p.icon" /></svg>
                <span>{{ p.label }}</span>
                @if (p.path === 'commandes' && data.newOrders()) { <span class="badge">{{ data.newOrders() }}</span> }
              </a>
            }
          }
        </nav>
        <div class="side-foot">
          <small>{{ auth.user()?.email }}</small>
          <small>{{ roleLabel() }}</small>
        </div>
      </aside>

      <div class="content">
        <header>
          <div class="bar">
            <button class="menu-btn" aria-label="Menu" (click)="menuOpen.set(true)">☰</button>
            <div class="who">
              <app-bell />
              <a class="btn light small" href="/" target="_blank">Voir le site</a>
              <button class="btn light small" (click)="logout()">Déconnexion</button>
            </div>
          </div>
        </header>
        <main><router-outlet /></main>
      </div>
      @if (data.toast()) { <div class="toast">{{ data.toast() }}</div> }
    </div>
  `,
})
export class AdminLayout implements OnInit, OnDestroy {
  // L'admin est en français, même si le visiteur a choisi l'arabe sur le site
  private readonly ltr = (document.documentElement.dir = 'ltr');

  protected readonly auth = inject(Auth);
  protected readonly data = inject(AdminData);
  private readonly router = inject(Router);
  protected readonly menuOpen = signal(false);
  protected readonly menu = computed(() => menuFor(this.auth.role()));
  protected readonly roleLabel = computed(() => {
    const r = this.auth.role();
    return r ? ROLE_LABELS[r] : '';
  });

  ngOnInit() {
    // Écoute permanente : badge et alertes restent à jour sur toutes les pages
    this.data.watchAll();
    // Le rapport s'ouvre tout seul à la première visite de la journée
    if (canOpen(this.auth.role(), 'rapport') && !reportSeenToday()) this.router.navigateByUrl('/admin/rapport');
  }

  ngOnDestroy() {
    this.data.unwatchAll();
  }

  protected async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl('/admin/login');
  }
}
