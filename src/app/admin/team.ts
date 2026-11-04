import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { AdminData, Member } from './admin-data';
import { Auth } from './auth';
import { ROLE_LABELS, Role } from './roles';

@Component({
  selector: 'app-team',
  imports: [FormsModule],
  template: `
    <div class="head"><h2>Équipe</h2></div>
    <div class="items">
      @for (m of members(); track m.uid) {
        <div class="item">
          <div class="info">
            <b>{{ m.email || 'Compte principal' }} @if (m.uid === me()) { <span class="pill">Vous</span> }</b>
            <small>{{ help[m.role] }}</small>
          </div>
          <select class="role" [value]="m.role" [disabled]="m.uid === me()" (change)="setRole(m, $any($event.target).value)">
            @for (r of roles; track r[0]) { <option [value]="r[0]" [selected]="r[0] === m.role">{{ r[1] }}</option> }
          </select>
          <button class="btn danger small" [disabled]="m.uid === me()" (click)="remove(m)">Retirer</button>
        </div>
      }
    </div>

    <form class="card-box add" #f="ngForm" (ngSubmit)="add(f)">
      <h3>Ajouter un membre</h3>
      <div class="grid2">
        <label>E-mail<input name="email" type="email" required autocomplete="off" [(ngModel)]="draft.email"></label>
        <label>Mot de passe (6 caractères minimum)<input name="password" type="password" required minlength="6" autocomplete="new-password" [(ngModel)]="draft.password"></label>
        <label>Rôle
          <select name="role" [(ngModel)]="draft.role">
            @for (r of roles; track r[0]) { <option [value]="r[0]">{{ r[1] }}</option> }
          </select>
        </label>
      </div>
      <small class="hint">{{ help[draft.role] }}</small>
      @if (error()) { <div class="msg">{{ error() }}</div> }
      <div><button class="btn" type="submit" [disabled]="f.invalid || busy()">{{ busy() ? 'Création…' : 'Créer le compte' }}</button></div>
    </form>
  `,
  styles: `
    .role { max-width: 220px; }
    .add { margin-top: 20px; }
    .add h3 { font-family: Inter, sans-serif; font-size: 1.05rem; }
    .hint { color: var(--muted); }
  `,
})
export class Team implements OnInit {
  private readonly data = inject(AdminData);
  private readonly auth = inject(Auth);
  protected readonly members = signal<Member[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly roles = Object.entries(ROLE_LABELS) as [Role, string][];
  protected readonly help: Record<Role, string> = {
    admin: 'Accès complet : paramètres, équipe, rayons et toutes les pages.',
    manager: 'Commandes, factures, rapport, stock, frigo, produits et formules.',
    commandes: 'Suivi des commandes et factures uniquement.',
  };
  protected draft: { email: string; password: string; role: Role } = { email: '', password: '', role: 'commandes' };

  protected me() {
    return this.auth.user()?.uid;
  }

  async ngOnInit() {
    await this.reload();
  }

  private async reload() {
    this.members.set(await this.data.listMembers());
  }

  protected async add(form: NgForm) {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.data.addMember(this.draft.email.trim(), this.draft.password, this.draft.role);
      form.resetForm({ email: '', password: '', role: 'commandes' });
      this.data.notify('Compte créé');
      await this.reload();
    } catch (e) {
      const code = (e as { code?: string }).code;
      this.error.set(code === 'auth/email-already-in-use' ? 'Cet e-mail a déjà un compte.'
        : code === 'auth/weak-password' ? 'Mot de passe trop court.'
        : (e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async setRole(m: Member, role: Role) {
    await this.data.setMemberRole(m, role);
    this.data.notify('Rôle modifié');
    await this.reload();
  }

  protected async remove(m: Member) {
    if (!confirm(`Retirer l'accès de ${m.email || m.uid} ?`)) return;
    await this.data.removeMember(m);
    this.data.notify('Accès retiré');
    await this.reload();
  }
}
