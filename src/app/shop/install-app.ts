import { Component, inject, signal } from '@angular/core';
import { I18n } from '../core/i18n';

const DISMISSED_KEY = 'installDismissed';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Propose d'installer le site comme une application, quand le navigateur le permet. */
@Component({
  selector: 'app-install',
  template: `
    @if (prompt()) {
      <div class="install-card" role="dialog" [attr.aria-label]="i18n.t('installApp')">
        <img src="icons/icon-192.png" alt="" width="46" height="46">
        <div><b>{{ i18n.t('installApp') }}</b><small>{{ i18n.t('installText') }}</small></div>
        <button class="btn btn-red" (click)="install()">{{ i18n.t('installBtn') }}</button>
        <button class="install-close" [attr.aria-label]="i18n.t('installLater')" (click)="dismiss()">✕</button>
      </div>
    }
  `,
  host: { '(window:beforeinstallprompt)': 'offer($event)', '(window:appinstalled)': 'prompt.set(null)' },
})
export class InstallApp {
  protected readonly i18n = inject(I18n);
  protected readonly prompt = signal<InstallPrompt | null>(null);

  protected offer(e: Event) {
    e.preventDefault();
    if (!wasDismissed()) this.prompt.set(e as InstallPrompt);
  }

  protected async install() {
    const event = this.prompt();
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    this.prompt.set(null);
  }

  protected dismiss() {
    this.prompt.set(null);
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch {}
  }
}
