import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { User, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db, firebaseApp } from '../core/firebase';
import { Role, canOpen } from './roles';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly auth = getAuth(firebaseApp);
  readonly user = signal<User | null>(null);
  /** Rôle du membre connecté, null s'il ne fait pas partie de l'équipe */
  readonly role = signal<Role | null>(null);
  private roleUid: string | null = null;

  /** Résolu dès que Firebase a restauré (ou non) la session. */
  private readonly ready = new Promise<void>(resolve =>
    onAuthStateChanged(this.auth, u => {
      this.user.set(u);
      if (!u) this.reset();
      resolve();
    }),
  );

  private reset() {
    this.roleUid = null;
    this.role.set(null);
  }

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  logout() {
    this.reset();
    return signOut(this.auth);
  }

  /** Un membre est un utilisateur connecté qui a un document admins/{uid}. */
  async loadRole(): Promise<Role | null> {
    await this.ready;
    const u = this.auth.currentUser;
    if (!u) return null;
    if (this.roleUid === u.uid) return this.role();
    try {
      const snap = await getDoc(doc(db, 'admins', u.uid));
      if (snap.exists()) {
        this.roleUid = u.uid;
        this.role.set((snap.data()['role'] as Role) ?? 'admin');
        return this.role();
      }
    } catch {}
    return null;
  }
}

/** Gardes de route : à appeler dans un contexte d'injection. */
export const adminGuard = async (): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  return !!(await inject(Auth).loadRole()) || router.parseUrl('/admin/login');
};

export const pageGuard = async (route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const role = await inject(Auth).loadRole();
  return canOpen(role, route.routeConfig?.path ?? '') || router.parseUrl('/admin/commandes');
};
