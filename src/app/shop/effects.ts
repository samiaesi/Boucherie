import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = () => matchMedia('(hover: hover)').matches;

/** Appelle fn quand l'élément entre à l'écran, une seule fois. */
function whenVisible(el: HTMLElement, fn: () => void) {
  const observer = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) {
      observer.disconnect();
      fn();
    }
  }, { threshold: 0.15 });
  observer.observe(el);
  return observer;
}

/** La carte s'incline en suivant la souris. */
@Directive({
  selector: '[appTilt]',
  host: { '(mousemove)': 'move($event)', '(mouseleave)': 'reset()' },
})
export class Tilt {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected move(e: MouseEvent) {
    if (!canHover() || reducedMotion()) return;
    const r = this.el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    this.el.style.transform = `perspective(900px) rotateX(${-y * 7}deg) rotateY(${x * 7}deg) translateY(-6px)`;
  }

  protected reset() {
    this.el.style.transform = '';
  }
}

/** Le nombre défile de 0 à sa valeur quand il apparaît. */
@Directive({ selector: '[appCount]' })
export class Count implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly appCount = input.required<number>();
  private observer?: IntersectionObserver;

  ngOnInit() {
    const target = this.appCount();
    this.el.textContent = String(target);
    if (reducedMotion()) return;
    this.el.textContent = '0';
    this.observer = whenVisible(this.el, () => {
      const start = performance.now(), duration = 1200;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        this.el.textContent = String(Math.round(target * (1 - (1 - t) ** 3)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
