import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Campaign, blankCampaign } from '../core/campaigns';
import { Product } from '../core/data';
import { Shop } from '../core/shop';
import { ReservationPage } from './reservation-page';

const mouton: Product = {
  id: 'mouton', category: 'agneau', order: 1, available: true, unit: 'kg', price: 2000, weights: [20000, 25000],
  name_fr: 'Mouton entier', name_ar: 'خروف', desc_fr: '', desc_ar: '',
};
const aid: Campaign = {
  ...blankCampaign(), id: 'aid', name_fr: "Mouton de l'Aïd", name_ar: 'خروف العيد', closes: '2099-01-10', pickupFrom: '2099-01-12', pickupTo: '2099-01-15', deposit: 5000, products: ['mouton'],
};

async function render() {
  const createOrder = vi.fn().mockResolvedValue('order1');
  TestBed.configureTestingModule({
    providers: [provideRouter([]), {
      provide: Shop,
      useValue: { campaigns: signal([aid]), products: signal([mouton]), clock: () => new Date('2098-12-01T10:00:00Z'), createOrder, customer: { name: '', tel: '' }, rememberCustomer: vi.fn() },
    }],
  });
  const fixture = TestBed.createComponent(ReservationPage);
  await fixture.whenStable();
  return { fixture, page: fixture.nativeElement as HTMLElement, createOrder };
}

const fill = (page: HTMLElement, name: string, value: string) => {
  const input = page.querySelector<HTMLInputElement>(`input[name=${name}]`)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
};

describe('Page de réservation', () => {
  it('choisit seule une offre unique et affiche l\'acompte', async () => {
    const { page } = await render();
    expect(page.textContent).toContain("Mouton de l'Aïd");
    expect(page.querySelector('.res-form')).not.toBeNull();
    expect(page.textContent!.replace(/\s/g, '')).toContain('5000DA');
  });

  it('crée une commande à la date choisie, au poids choisi', async () => {
    const { fixture, page, createOrder } = await render();
    await fixture.whenStable();
    [...page.querySelectorAll<HTMLButtonElement>('.res-form .chip')][1].click();
    await fixture.whenStable();
    fill(page, 'name', 'Karim');
    fill(page, 'tel', '05 55 12 34 56');
    fill(page, 'date', '2099-01-13');
    await fixture.whenStable();
    page.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(createOrder).toHaveBeenCalledOnce();
    const order = createOrder.mock.calls[0][0];
    expect(order).toMatchObject({ name: 'Karim', tel: '0555123456', type: 'retrait', date: '2099-01-13', total: 50000, delivery: 0 });
    expect(order.items[0]).toMatchObject({ productId: 'mouton', grams: 25000, qty: 1, total: 50000 });
    expect(JSON.stringify(order)).not.toContain('undefined');
    expect(Object.keys(order).every(k => ['name', 'tel', 'type', 'typeLabel', 'date', 'details', 'lang', 'items', 'delivery', 'total'].includes(k))).toBe(true);
  });

  it('refuse une date hors de la période', async () => {
    const { fixture, page, createOrder } = await render();
    fill(page, 'name', 'Karim');
    fill(page, 'tel', '0555123456');
    fill(page, 'date', '2099-02-01');
    await fixture.whenStable();
    page.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(createOrder).not.toHaveBeenCalled();
    expect(page.querySelector('.form-error')).not.toBeNull();
  });
});
