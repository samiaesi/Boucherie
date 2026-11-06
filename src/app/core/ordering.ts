/** Horaires d'un jour de semaine ; 0 = dimanche, comme Date.getDay() */
export interface DaySchedule {
  day: number;
  open: boolean;
  /** HH:MM */
  from: string;
  to: string;
}

/** Créneau sans commande : chaque jour si date est vide, sinon ce jour-là seulement */
export interface ClosedSlot {
  date: string;
  from: string;
  to: string;
}

/** Jour de fermeture exceptionnelle */
export interface ClosedDay {
  date: string;
  reason: string;
}

export interface OrderingRules {
  schedule: DaySchedule[];
  closedSlots: ClosedSlot[];
  closedDays: ClosedDay[];
  /** Fermeture immédiate par l'administrateur, sans date de reprise */
  ordersPaused: boolean;
  pauseReason: string;
}

export type ClosedReason = 'paused' | 'closedDay' | 'slot' | 'hours';

export interface OrderingState {
  open: boolean;
  reason?: ClosedReason;
  /** Motif saisi par l'administrateur */
  note?: string;
  /** Prochaine ouverture, inconnue pendant une fermeture manuelle */
  reopens?: { date: string; time: string };
}

export const DEFAULT_SCHEDULE: DaySchedule[] = [0, 1, 2, 3, 4, 5, 6].map(day => (
  { day, open: true, from: '07:00', to: day === 5 ? '12:00' : '20:00' }));

export const DEFAULT_ORDERING: OrderingRules = {
  schedule: DEFAULT_SCHEDULE, closedSlots: [], closedDays: [], ordersPaused: false, pauseReason: '',
};

/** Semaine affichée à partir du samedi */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];

const SEARCH_DAYS = 14;

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Jour et heure en Algérie, quel que soit le réglage de l'appareil du client. */
export function algeriaClock(at: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at).map(p => [p.type, p.value]));
  return { date: `${parts['year']}-${parts['month']}-${parts['day']}`, minutes: Number(parts['hour']) * 60 + Number(parts['minute']) };
}

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const slotsOf = (r: OrderingRules, date: string) =>
  r.closedSlots.filter(s => !s.date || s.date === date)
    .map(s => ({ from: toMinutes(s.from), to: toMinutes(s.to) }))
    .sort((a, b) => a.from - b.from);

/** Vrai si la boutique accepte des commandes ou des retraits ce jour-là. */
export function dayIsOpen(r: OrderingRules, date: string) {
  return !r.closedDays.some(d => d.date === date) && !!r.schedule.find(d => d.day === weekday(date))?.open;
}

/** Première minute ouverte d'un jour à partir de `after`, ou null. */
function firstOpenMinute(r: OrderingRules, date: string, after: number) {
  if (!dayIsOpen(r, date)) return null;
  const day = r.schedule.find(d => d.day === weekday(date))!;
  let minute = Math.max(after, toMinutes(day.from));
  for (const slot of slotsOf(r, date)) {
    if (minute >= slot.from && minute < slot.to) minute = slot.to;
  }
  return minute < toMinutes(day.to) ? minute : null;
}

function nextOpening(r: OrderingRules, date: string, minutes: number) {
  for (let i = 0; i <= SEARCH_DAYS; i++) {
    const d = addDays(date, i);
    const first = firstOpenMinute(r, d, i === 0 ? minutes : 0);
    if (first !== null) return { date: d, time: toTime(first) };
  }
  return undefined;
}

/** Une commande spéciale se prépare : le retrait est au moins 6 h après la confirmation par la boutique. */
export const SPECIAL_LEAD_MINUTES = 360;
const SLOT_STEP = 60;

/** Moment où la boutique pourra confirmer : maintenant si elle est ouverte, sinon à sa prochaine ouverture. */
function confirmationMoment(r: OrderingRules, at: Date) {
  const clock = algeriaClock(at);
  const state = orderingState({ ...r, ordersPaused: false }, at);
  return !state.open && state.reopens ? { date: state.reopens.date, minutes: toMinutes(state.reopens.time) } : clock;
}

/** Heure à partir de laquelle une commande confirmée maintenant sera prête, ex. « 16:00 ». */
export function specialReadyTime(at: Date) {
  const { minutes } = algeriaClock(at);
  return toTime((minutes + SPECIAL_LEAD_MINUTES) % (24 * 60));
}

/** La réservation reste possible boutique fermée, sauf fermeture manuelle (maintenance). */
export const canReserveSpecial = (r: OrderingRules) => !r.ordersPaused;

/** Créneaux de retrait d'un jour pour une commande spéciale, en heures d'ouverture. */
export function specialSlots(r: OrderingRules, date: string, at: Date) {
  const confirm = confirmationMoment(r, at);
  if (date < confirm.date || !dayIsOpen(r, date)) return [];
  const day = r.schedule.find(d => d.day === weekday(date))!;
  const earliest = date === confirm.date ? confirm.minutes + SPECIAL_LEAD_MINUTES : 0;
  const closed = slotsOf(r, date);
  const slots: string[] = [];
  for (let m = toMinutes(day.from); m < toMinutes(day.to); m += SLOT_STEP) {
    if (m >= earliest && !closed.some(s => m >= s.from && m < s.to)) slots.push(toTime(m));
  }
  return slots;
}

/** Premier jour où une commande spéciale peut être retirée. */
export function firstSpecialDate(r: OrderingRules, at: Date) {
  const { date } = algeriaClock(at);
  for (let i = 0; i <= SEARCH_DAYS; i++) {
    const d = addDays(date, i);
    if (specialSlots(r, d, at).length) return d;
  }
  return date;
}

/** Jours consécutifs aux mêmes horaires, regroupés pour l'affichage. */
export function scheduleLines(schedule: DaySchedule[]) {
  const lines: { first: number; last: number; open: boolean; from: string; to: string }[] = [];
  for (const day of WEEK_ORDER) {
    const d = schedule.find(x => x.day === day);
    if (!d) continue;
    const prev = lines.at(-1);
    if (prev && prev.open === d.open && (!d.open || (prev.from === d.from && prev.to === d.to))) prev.last = day;
    else lines.push({ first: day, last: day, open: d.open, from: d.from, to: d.to });
  }
  return lines;
}

export function orderingState(r: OrderingRules, at: Date): OrderingState {
  if (r.ordersPaused) return { open: false, reason: 'paused', note: r.pauseReason };
  const { date, minutes } = algeriaClock(at);
  if (firstOpenMinute(r, date, minutes) === minutes) return { open: true };

  const reopens = nextOpening(r, date, minutes);
  const closedDay = r.closedDays.find(d => d.date === date);
  if (closedDay) return { open: false, reason: 'closedDay', note: closedDay.reason, reopens };
  const inSlot = slotsOf(r, date).some(s => minutes >= s.from && minutes < s.to);
  return { open: false, reason: inSlot ? 'slot' : 'hours', reopens };
}
