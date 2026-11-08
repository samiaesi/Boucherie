import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export const CHAIN_STEPS = [
  { path: 'arrivages', label: 'Arrivage', hint: 'La marchandise entre' },
  { path: 'frigo', label: 'Frigo', hint: 'Les bêtes entières' },
  { path: 'decoupe', label: 'Découpe', hint: 'Bêtes → coupes' },
  { path: 'chaine', label: 'Rayons', hint: 'Mise en vente' },
  { path: 'stock', label: 'Stock', hint: 'Les ventes la retirent' },
  { path: 'destockage', label: 'Déstockage', hint: 'Pertes, retours' },
] as const;

/** Bandeau commun aux pages du stock : on voit où l'on est dans la chaîne. */
@Component({
  selector: 'app-chain-steps',
  imports: [RouterLink],
  template: `
    <nav class="chain" aria-label="Chaîne du stock">
      @for (s of steps; track s.path; let i = $index) {
        <a [routerLink]="'/admin/' + s.path" [class.here]="s.path === current()" [attr.aria-current]="s.path === current() ? 'step' : null">
          <i>{{ i + 1 }}</i><span><b>{{ s.label }}</b><small>{{ s.hint }}</small></span>
        </a>
      }
    </nav>
  `,
  styles: `
    .chain { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0; margin: 0 0 18px; padding: 4px; background: #fff; border: 1px solid var(--line); border-radius: 14px; }
    a { position: relative; display: flex; align-items: center; gap: 9px; padding: 9px 12px 9px 10px; color: inherit; text-decoration: none; border-radius: 10px; }
    a + a::before { content: ""; position: absolute; inset-inline-start: -6px; top: 50%; width: 10px; height: 10px; margin-top: -5px; border-top: 2px solid #cfc6bc; border-inline-end: 2px solid #cfc6bc; transform: rotate(45deg); }
    a:hover { background: var(--bg); }
    a.here { background: #a10c20; color: #fff; }
    i { flex: none; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--bg); font-style: normal; font-weight: 700; font-size: .82rem; }
    a.here i { background: #fff; color: #a10c20; }
    span { min-width: 0; }
    b { display: block; font-size: .9rem; }
    small { display: block; color: var(--muted); font-size: .74rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    a.here small { color: rgba(255, 255, 255, .8); }
    @media (max-width: 800px) {
      .chain { grid-template-columns: repeat(6, auto); overflow-x: auto; }
      small { display: none; }
    }
  `,
})
export class ChainSteps {
  readonly current = input.required<string>();
  protected readonly steps = CHAIN_STEPS;
}
