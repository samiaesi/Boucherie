import { useAdminApp } from './admin-app';
import { Logo } from '../core/logo';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminData } from './admin-data';
import { Auth } from './auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule, Logo],
  template: `
    <section class="adm login">
      <form class="login-card" (ngSubmit)="submit()">
        <app-logo />
        <h1>Espace administration</h1>
        <input type="email" name="email" placeholder="Email" required autocomplete="username" [(ngModel)]="email">
        <input type="password" name="password" placeholder="Mot de passe" required autocomplete="current-password" [(ngModel)]="password">
        <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Connexion…' : 'Se connecter' }}</button>
        @if (error()) { <div class="msg" [innerHTML]="error()"></div> }
      </form>
    </section>
  `,
})
export class Login {
  private readonly installable = useAdminApp();
  // L'admin est en français, même si le visiteur a choisi l'arabe sur le site
  private readonly ltr = (document.documentElement.dir = 'ltr');

  private readonly auth = inject(Auth);
  private readonly data = inject(AdminData);
  private readonly router = inject(Router);
  protected email = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      const { user } = await this.auth.login(this.email, this.password);
      if (await this.auth.loadRole()) {
        this.data.audit('login', user.email ?? '');
        await this.router.navigateByUrl('/admin');
        return;
      }
      this.error.set(`Ce compte n'est pas administrateur. Créez le document <code>admins/${user.uid}</code> dans Firestore pour lui donner l'accès.`);
      await this.auth.logout();
    } catch (e) {
      this.error.set(this.message((e as { code?: string }).code));
    } finally {
      this.busy.set(false);
    }
  }

  /** Chaque cause a sa solution : on ne les regroupe pas sous un seul message. */
  private message(code = 'inconnue') {
    switch (code) {
      case 'auth/operation-not-allowed':
        return "La connexion par e-mail n'est pas activée : dans Firebase, Authentication > Méthode de connexion, activez E-mail/Mot de passe.";
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email ou mot de passe incorrect, ou compte inexistant.';
      case 'auth/invalid-email':
      case 'auth/missing-email':
        return "L'adresse e-mail n'est pas valide.";
      case 'auth/missing-password':
        return 'Entrez votre mot de passe.';
      case 'auth/user-disabled':
        return 'Ce compte a été désactivé dans Firebase.';
      case 'auth/too-many-requests':
        return 'Trop de tentatives : attendez quelques minutes avant de réessayer.';
      case 'auth/network-request-failed':
        return 'Connexion à Firebase impossible : vérifiez votre connexion internet.';
      default:
        return `Connexion impossible (code : ${code}).`;
    }
  }
}
