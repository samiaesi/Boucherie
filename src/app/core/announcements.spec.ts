import { Announcement, announcementMessage, liveAnnouncements, subscribers } from './announcements';
import { Order } from './data';

const ann = (over: Partial<Announcement>): Announcement => ({
  id: 'a', kind: 'arrivage', title_fr: 'Agneau frais', title_ar: 'خروف طازج', text_fr: 'Arrivé ce matin', text_ar: '',
  start: '2026-11-04', end: '2026-11-04', ...over,
});

const order = (over: Partial<Order>): Order => ({
  id: 'x', name: 'Karim', tel: '0555123456', type: 'retrait', typeLabel: '', date: '', details: '', lang: 'fr', status: 'récupéré', ...over,
});

describe('Annonces', () => {
  it('affiche seulement les annonces du jour, bornes comprises', () => {
    const list = [
      ann({ id: 'avant', start: '2026-11-01', end: '2026-11-03' }),
      ann({ id: 'pile' }),
      ann({ id: 'apres', start: '2026-11-05', end: '2026-11-06' }),
    ];
    expect(liveAnnouncements(list, '2026-11-04').map(a => a.id)).toEqual(['pile']);
  });

  it('met la plus récente en premier', () => {
    const list = [ann({ id: 'ancienne', start: '2026-11-01' }), ann({ id: 'recente', start: '2026-11-04' })];
    expect(liveAnnouncements(list, '2026-11-04')[0].id).toBe('recente');
  });

  it('écrit le message dans la langue du client, avec repli sur le français', () => {
    const ar = announcementMessage(ann({}), 'ar', 'Boucherie Hallem', 'https://x');
    expect(ar).toContain('وصول جديد');
    expect(ar).toContain('خروف طازج');
    expect(ar).toContain('Arrivé ce matin');
    expect(ar).toContain('https://x');
  });
});

describe('Abonnés', () => {
  it('garde seulement les clients qui ont accepté', () => {
    const list = subscribers([order({ tel: '1', marketing: true }), order({ tel: '2' })]);
    expect(list.map(s => s.tel)).toEqual(['1']);
  });

  it('ne compte chaque numéro qu\'une fois', () => {
    expect(subscribers([order({ marketing: true }), order({ marketing: true })])).toHaveLength(1);
  });

  it('respecte le dernier choix du client', () => {
    expect(subscribers([order({}), order({ marketing: true })])).toEqual([]);
  });
});
