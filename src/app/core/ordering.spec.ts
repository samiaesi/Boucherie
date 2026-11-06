import { DEFAULT_SCHEDULE, OrderingRules, algeriaClock, canReserveSpecial, dayIsOpen, firstSpecialDate, orderingState, scheduleLines, specialReadyTime, specialSlots } from './ordering';

const rules = (over: Partial<OrderingRules> = {}): OrderingRules => ({
  schedule: DEFAULT_SCHEDULE, closedSlots: [], closedDays: [], ordersPaused: false, pauseReason: '', ...over,
});

/** Heure d'Algérie (UTC+1). Le 4 novembre 2026 est un mercredi. */
const at = (date: string, time: string) => new Date(`${date}T${time}:00+01:00`);

describe('Horloge', () => {
  it('donne l\'heure de l\'Algérie, quel que soit le fuseau de l\'appareil', () => {
    expect(algeriaClock(new Date('2026-11-04T23:30:00Z'))).toEqual({ date: '2026-11-05', minutes: 30 });
  });
});

describe('orderingState', () => {
  it('accepte les commandes pendant les horaires', () => {
    expect(orderingState(rules(), at('2026-11-04', '10:00')).open).toBe(true);
  });

  it('respecte les bornes : ouvert à l\'ouverture, fermé à la fermeture', () => {
    expect(orderingState(rules(), at('2026-11-04', '07:00')).open).toBe(true);
    expect(orderingState(rules(), at('2026-11-04', '19:59')).open).toBe(true);
    expect(orderingState(rules(), at('2026-11-04', '20:00')).open).toBe(false);
  });

  it('refuse avant l\'ouverture et annonce la reprise du jour', () => {
    expect(orderingState(rules(), at('2026-11-04', '06:00')))
      .toEqual({ open: false, reason: 'hours', reopens: { date: '2026-11-04', time: '07:00' } });
  });

  it('annonce le lendemain après la fermeture', () => {
    expect(orderingState(rules(), at('2026-11-04', '21:00')).reopens).toEqual({ date: '2026-11-05', time: '07:00' });
  });

  it('applique les horaires courts du vendredi', () => {
    expect(orderingState(rules(), at('2026-11-06', '13:00')).reopens).toEqual({ date: '2026-11-07', time: '07:00' });
  });

  it('bloque un créneau de chaque jour, 6h à 9h, et reprend à sa fin', () => {
    const r = rules({
      closedSlots: [{ date: '', from: '06:00', to: '09:00' }],
    });
    const s = orderingState(r, at('2026-11-04', '08:00'));
    expect([s.open, s.reason]).toEqual([false, 'slot']);
    expect(s.reopens).toEqual({ date: '2026-11-04', time: '09:00' });
    expect(orderingState(r, at('2026-11-04', '09:00')).open).toBe(true);
  });

  it('bloque un créneau d\'un seul jour', () => {
    const r = rules({ closedSlots: [{ date: '2026-11-04', from: '10:00', to: '12:00' }] });
    expect(orderingState(r, at('2026-11-04', '11:00')).open).toBe(false);
    expect(orderingState(r, at('2026-11-05', '11:00')).open).toBe(true);
  });

  it('enchaîne deux créneaux collés', () => {
    const r = rules({ closedSlots: [{ date: '', from: '10:00', to: '11:00' }, { date: '', from: '11:00', to: '12:00' }] });
    expect(orderingState(r, at('2026-11-04', '10:30')).reopens?.time).toBe('12:00');
  });

  it('passe au lendemain si un créneau va jusqu\'à la fermeture', () => {
    const r = rules({ closedSlots: [{ date: '', from: '18:00', to: '20:00' }] });
    expect(orderingState(r, at('2026-11-04', '19:00')).reopens).toEqual({ date: '2026-11-05', time: '07:00' });
  });

  it('ferme un jour exceptionnel avec son motif', () => {
    const r = rules({ closedDays: [{ date: '2026-11-04', reason: 'Inventaire' }] });
    expect(orderingState(r, at('2026-11-04', '10:00'))).toEqual({
      open: false, reason: 'closedDay', note: 'Inventaire', reopens: { date: '2026-11-05', time: '07:00' },
    });
  });

  it('saute les jours fermés de la semaine', () => {
    const schedule = DEFAULT_SCHEDULE.map(d => (d.day === 5 ? { ...d, open: false } : d));
    expect(orderingState(rules({ schedule }), at('2026-11-05', '21:00')).reopens).toEqual({ date: '2026-11-07', time: '07:00' });
  });

  it('ferme tout en maintenance, sans date de reprise', () => {
    const s = orderingState(rules({ ordersPaused: true, pauseReason: 'Maintenance' }), at('2026-11-04', '10:00'));
    expect(s).toEqual({ open: false, reason: 'paused', note: 'Maintenance' });
  });
});

describe('scheduleLines', () => {
  it('regroupe les jours aux mêmes horaires, à partir du samedi', () => {
    expect(scheduleLines(DEFAULT_SCHEDULE)).toEqual([
      { first: 6, last: 4, open: true, from: '07:00', to: '20:00' },
      { first: 5, last: 5, open: true, from: '07:00', to: '12:00' },
    ]);
  });

  it('isole un jour fermé', () => {
    const schedule = DEFAULT_SCHEDULE.map(d => (d.day === 1 ? { ...d, open: false } : d));
    expect(scheduleLines(schedule).map(l => [l.first, l.last, l.open])).toEqual([
      [6, 0, true], [1, 1, false], [2, 4, true], [5, 5, true],
    ]);
  });
});

describe('dayIsOpen', () => {
  it('refuse un jour fermé ou exceptionnel pour le retrait', () => {
    const schedule = DEFAULT_SCHEDULE.map(d => (d.day === 5 ? { ...d, open: false } : d));
    const r = rules({ schedule, closedDays: [{ date: '2026-11-05', reason: '' }] });
    expect(dayIsOpen(r, '2026-11-04')).toBe(true);
    expect(dayIsOpen(r, '2026-11-05')).toBe(false);
    expect(dayIsOpen(r, '2026-11-06')).toBe(false);
  });
});

describe('Commandes spéciales', () => {
  it('garde 6 h de préparation le jour même', () => {
    expect(specialSlots(rules(), '2026-11-04', at('2026-11-04', '10:00'))).toEqual(['16:00', '17:00', '18:00', '19:00']);
  });

  it('refuse le jour même à moins de 6 h de la fermeture', () => {
    expect(specialSlots(rules(), '2026-11-04', at('2026-11-04', '14:30'))).toEqual([]);
    expect(firstSpecialDate(rules(), at('2026-11-04', '14:30'))).toBe('2026-11-05');
  });

  it('propose toute la journée du lendemain', () => {
    const slots = specialSlots(rules(), '2026-11-05', at('2026-11-04', '19:00'));
    expect([slots[0], slots.at(-1), slots.length]).toEqual(['07:00', '19:00', 13]);
  });

  it('respecte les horaires courts, les créneaux et les jours fermés', () => {
    expect(specialSlots(rules(), '2026-11-06', at('2026-11-05', '10:00')).at(-1)).toBe('11:00');
    const closed = rules({ closedSlots: [{ date: '', from: '07:00', to: '09:00' }], closedDays: [{ date: '2026-11-07', reason: '' }] });
    expect(specialSlots(closed, '2026-11-05', at('2026-11-04', '10:00'))[0]).toBe('09:00');
    expect(specialSlots(closed, '2026-11-07', at('2026-11-04', '10:00'))).toEqual([]);
  });

  it('ne propose jamais une date passée', () => {
    expect(specialSlots(rules(), '2026-11-03', at('2026-11-04', '10:00'))).toEqual([]);
  });
});

describe('Réservation boutique fermée', () => {
  it('compte les 6 h depuis la prochaine ouverture, quand la boutique pourra confirmer', () => {
    const slots = specialSlots(rules(), '2026-11-05', at('2026-11-04', '22:00'));
    expect([slots[0], firstSpecialDate(rules(), at('2026-11-04', '22:00'))]).toEqual(['13:00', '2026-11-05']);
  });

  it('compte depuis 7 h aussi tôt le matin', () => {
    expect(specialSlots(rules(), '2026-11-04', at('2026-11-04', '05:00'))[0]).toBe('13:00');
  });

  it('passe au jour suivant si l\'ouverture est trop courte, comme le vendredi', () => {
    expect(specialSlots(rules(), '2026-11-06', at('2026-11-05', '21:00'))).toEqual([]);
    expect(firstSpecialDate(rules(), at('2026-11-05', '21:00'))).toBe('2026-11-07');
  });

  it('bloque la réservation pendant une fermeture manuelle', () => {
    expect(canReserveSpecial(rules())).toBe(true);
    expect(canReserveSpecial(rules({ ordersPaused: true }))).toBe(false);
  });

  it('annonce l\'heure où la commande sera prête après confirmation', () => {
    expect(specialReadyTime(at('2026-11-04', '07:30'))).toBe('13:30');
  });
});
