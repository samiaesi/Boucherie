import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Cart } from '../core/cart';
import { Product } from '../core/data';
import { Shop } from '../core/shop';
import { ProductPage } from './product-page';

const LABOUR = 1234;
const product: Product = {
  id: 'poulet-farci', category: 'speciales', order: 1, available: true, special: true, unit: 'order', price: LABOUR,
  name_fr: 'Poulet farci', name_ar: 'دجاج محشي', desc_fr: '', desc_ar: '',
  origins: [{ country: 'Algérie', price: LABOUR }, { country: 'Espagne', price: LABOUR + 100 }],
  custom: {
    meats: [{ fr: 'Poulet', ar: 'دجاج', price: 800 }, { fr: 'Bœuf', ar: 'لحم بقر', price: 2000 }],
    grams: [250, 500],
    extras: [{ fr: 'Champignons', ar: 'فطر', price: 150 }, { fr: 'Olives', ar: 'زيتون', price: 0 }],
  },
};

async function render() {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), {
      provide: Shop,
      useValue: { products: signal([product]), category: () => undefined, pickupKey: () => 'pickup', settings: signal({ whatsapp: '' }), clock: () => new Date() },
    }],
  });
  const fixture = TestBed.createComponent(ProductPage);
  fixture.componentRef.setInput('id', 'poulet-farci');
  await fixture.whenStable();
  const page = fixture.nativeElement as HTMLElement;
  const click = async (label: string) => {
    [...page.querySelectorAll('button')].find(b => b.textContent!.includes(label))!.click();
    await fixture.whenStable();
  };
  return { page, click };
}

describe('Page d\'une commande spéciale personnalisée', () => {
  beforeEach(() => localStorage.removeItem('cart'));

  it('montre les choix et le prix final, jamais le prix de base', async () => {
    const { page, click } = await render();
    const money = () => page.querySelector('.buy-total')!.textContent!.replace(/\s/g, '');
    expect(page.textContent).toContain('Champignons');
    expect(money()).toContain('1434');
    await click('Bœuf');
    await click('500 g');
    await click('Champignons');
    expect(money()).toContain('2384');
    expect(page.textContent!.replace(/\s/g, '')).not.toMatch(/1234|1334/);
  });

  it('accepte un autre poids de viande, comme 600 g', async () => {
    const { page, click } = await render();
    await click('Bœuf');
    await click('Autre');
    const box = page.querySelector<HTMLInputElement>('.inline-field input')!;
    box.value = '600';
    box.dispatchEvent(new Event('input'));
    await click('Ajouter au panier');
    expect(TestBed.inject(Cart).lines()[0]).toMatchObject({ price: LABOUR + 1200, option_fr: 'Bœuf 600 g' });
  });

  it('refuse un poids de viande trop petit', async () => {
    const { page, click } = await render();
    await click('Autre');
    const box = page.querySelector<HTMLInputElement>('.inline-field input')!;
    box.value = '50';
    box.dispatchEvent(new Event('input'));
    await click('Olives');
    const add = [...page.querySelectorAll('button')].find(b => b.textContent!.includes('Ajouter au panier'))!;
    expect(add.disabled).toBe(true);
  });

  it('met dans le panier le prix final et le détail des choix', async () => {
    const { click } = await render();
    await click('Bœuf');
    await click('Olives');
    await click('Ajouter au panier');
    const [line] = TestBed.inject(Cart).lines();
    expect(line).toMatchObject({ unit: 'piece', price: 1734, special: true, option_fr: 'Bœuf 250 g · Olives' });
    expect(line.origin).toBeUndefined();
  });
});
