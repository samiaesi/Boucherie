import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONS } from './data';

/** Illustration SVG d'après son nom. Seules les constantes de ICONS sont insérées. */
@Pipe({ name: 'icon' })
export class IconPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(name: string | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(ICONS[name ?? ''] ?? ICONS['boeuf']);
  }
}
