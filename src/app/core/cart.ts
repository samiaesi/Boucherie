import { Injectable, computed, effect, signal } from '@angular/core';
import { Unit } from './data';

export interface CartLine {
  key: string;
  productId: string;
  name_fr: string;
  name_ar: string;
  unit: Unit;
  price: number;
  grams?: number;
  option_fr?: string;
  option_ar?: string;
  /** Pays choisi par le client, en français */
  origin?: string;
  qty: number;
}

export function lineTotal(l: CartLine) {
  if (l.unit === 'kg') return Math.round((l.price * (l.grams ?? 0) * l.qty) / 1000);
  return l.unit === 'piece' ? l.price * l.qty : 0;
}

function savedCart(): CartLine[] {
  try {
    return JSON.parse(localStorage.getItem('cart') ?? '[]');
  } catch {
    return [];
  }
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Panier du visiteur, conservé dans son navigateur. */
@Injectable({ providedIn: 'root' })
export class Cart {
  readonly lines = signal<CartLine[]>(savedCart());
  readonly open = signal(false);
  /** Nom du dernier article ajouté, le temps de l'annonce */
  readonly justAdded = signal('');
  /** Message temporaire, par exemple pour un produit épuisé */
  readonly warning = signal('');
  /** Change à chaque ajout : relance l'animation de l'icône du panier */
  readonly bump = signal(0);
  readonly count = computed(() => this.lines().reduce((n, l) => n + l.qty, 0));
  readonly total = computed(() => this.lines().reduce((n, l) => n + lineTotal(l), 0));
  private hideTimer?: ReturnType<typeof setTimeout>;
  private warnTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const lines = this.lines();
      try { localStorage.setItem('cart', JSON.stringify(lines)); } catch {}
    });
  }

  add(line: Omit<CartLine, 'key'>, label: string, from?: HTMLElement) {
    const key = [line.productId, line.grams ?? '', line.option_fr ?? '', line.origin ?? ''].join('|');
    this.lines.update(all => all.some(l => l.key === key)
      ? all.map(l => (l.key === key ? { ...l, qty: l.qty + line.qty } : l))
      : [...all, { ...line, key }]);
    this.bump.update(n => n + 1);
    this.justAdded.set(label);
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.justAdded.set(''), 2600);
    if (from) this.flyToCart(from);
  }

  warn(text: string) {
    this.warning.set(text);
    clearTimeout(this.warnTimer);
    this.warnTimer = setTimeout(() => this.warning.set(''), 5000);
  }

  /** Une vignette de l'article vole jusqu'à l'icône du panier. */
  private flyToCart(from: HTMLElement) {
    const target = document.querySelector('.cart-btn');
    if (!target || reducedMotion()) return;
    const a = from.getBoundingClientRect(), b = target.getBoundingClientRect();
    const dot = from.cloneNode(true) as HTMLElement;
    Object.assign(dot.style, {
      position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`,
      margin: '0', zIndex: '100', pointerEvents: 'none', objectFit: 'cover', borderRadius: '50%', overflow: 'hidden',
    });
    document.body.append(dot);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    dot.animate([
      { transform: 'none', opacity: 1 },
      { transform: `translate(${dx * 0.6}px, ${dy * 0.3 - 40}px) scale(.55)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${dx}px, ${dy}px) scale(.08)`, opacity: 0.3 },
    ], { duration: 750, easing: 'cubic-bezier(.5, 0, .3, 1)' }).onfinish = () => dot.remove();
  }

  setQty(key: string, qty: number) {
    this.lines.update(all => (qty < 1
      ? all.filter(l => l.key !== key)
      : all.map(l => (l.key === key ? { ...l, qty } : l))));
  }

  clear() {
    this.lines.set([]);
  }
}
