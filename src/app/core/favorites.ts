import { Injectable, computed, effect, signal } from '@angular/core';

const KEY = 'favorites';

function saved(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Produits préférés du visiteur, conservés dans son navigateur. */
@Injectable({ providedIn: 'root' })
export class Favorites {
  readonly ids = signal<string[]>(saved());
  readonly count = computed(() => this.ids().length);

  constructor() {
    effect(() => {
      const ids = this.ids();
      try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch {}
    });
  }

  has(id: string) {
    return this.ids().includes(id);
  }

  toggle(id: string) {
    this.ids.update(all => (all.includes(id) ? all.filter(x => x !== id) : [id, ...all]));
  }
}
