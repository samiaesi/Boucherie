import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

/** Fait apparaître l'élément quand il entre à l'écran, avec un décalage facultatif (en ms). */
@Directive({ selector: '[appReveal]', host: { class: 'reveal' } })
export class Reveal implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly revealDelay = input(0);
  private observer?: IntersectionObserver;

  ngOnInit() {
    this.el.style.transitionDelay = `${this.revealDelay()}ms`;
    this.observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        this.el.classList.add('in');
        this.observer?.disconnect();
      }
    }, { threshold: 0.12 });
    this.observer.observe(this.el);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
