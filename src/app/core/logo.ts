import { Component } from '@angular/core';

const arc = (word: string, first: number, step: number) => [...word].map((char, i) => ({ char, angle: first + i * step }));

/** Logo animé : même dessin que public/logo.svg, gardé en fichier pour l'onglet, les factures et les étiquettes. */
@Component({
  selector: 'app-logo',
  template: `
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="98" fill="#d0102a" />
      <circle cx="100" cy="100" r="92" fill="none" stroke="#fff" stroke-width="1.5" />
      <circle cx="100" cy="100" r="64" fill="none" stroke="#fff" stroke-width="1.5" />
      <g transform="translate(38 40) scale(.62)" fill="#fff">
        <g class="bird">
          <g class="tail">
            <path d="M78 116C58 104 40 72 52 40 54 66 66 90 86 104Z" />
            <path d="M74 122C50 118 28 94 28 62 38 88 56 104 80 112Z" />
            <path d="M72 128C52 134 30 124 20 100 36 114 54 120 74 118Z" />
          </g>
          <path d="M108 144L106 166h9M124 142L126 166h9" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M130 62C130 50 140 46 150 50L166 57 152 63C151 74 152 84 155 94 160 114 150 134 126 142 106 148 86 142 76 126 74 120 76 114 80 110 84 104 90 100 98 98 116 92 126 78 130 62Z" />
          <path d="M132 52C128 42 134 36 138 42 138 32 148 32 148 42 152 36 160 40 154 50 148 46 140 47 132 52Z" />
          <path d="M151 66C156 72 153 80 148 76Z" />
          <path d="M98 118C110 106 130 108 138 118 128 132 110 134 98 118ZM110 118C116 114 124 114 130 118" fill="none" stroke="#d0102a" stroke-width="3.5" stroke-linecap="round" />
        </g>
      </g>
      <g class="name">
        @for (l of top; track $index) {
          <text x="100" y="30" font-size="15" [attr.transform]="'rotate(' + l.angle + ' 100 100)'">{{ l.char }}</text>
        }
        @for (l of bottom; track $index) {
          <text x="100" y="183" font-size="17" font-weight="700" [attr.transform]="'rotate(' + l.angle + ' 100 100)'">{{ l.char }}</text>
        }
      </g>
      <circle cx="23" cy="104" r="3" fill="#fff" />
      <circle cx="177" cy="104" r="3" fill="#fff" />
    </svg>
  `,
  styles: `
    :host { display: block; flex: none; aspect-ratio: 1; transition: transform .4s cubic-bezier(.2, .8, .2, 1); }
    svg { display: block; width: 100%; height: 100%; }
    .name { fill: #fff; font-family: Georgia, 'Times New Roman', serif; text-anchor: middle; }
    .bird { transform-origin: 100px 145px; }
    .tail { transform-origin: 80px 115px; animation: settle 8s ease-in-out infinite; }
    :host(:hover), :host-context(a:hover) { transform: scale(1.06); }
    :host(:hover) .bird, :host-context(a:hover) .bird { animation: bob .9s ease-in-out infinite; }
    :host(:hover) .tail, :host-context(a:hover) .tail { animation: sway .9s ease-in-out infinite; }
    @keyframes settle { 0%, 90%, 100% { transform: none; } 94% { transform: rotate(-5deg); } 97% { transform: rotate(3deg); } }
    @keyframes bob { 0%, 100% { transform: none; } 50% { transform: translateY(-5px); } }
    @keyframes sway { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
    @media (prefers-reduced-motion: reduce) { .bird, .tail { animation: none !important; } }
  `,
})
export class Logo {
  /** Lettres posées une à une sur l'arc : même rendu partout, sans dépendre de l'adresse de la page */
  protected readonly top = arc('BOUCHERIE', -38, 9.5);
  protected readonly bottom = arc('HALLEM', 30, -12);
}
