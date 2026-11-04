import {
  DEFAULT_SETTINGS, FridgeItem, Order, Product, Settings, animals, isLowStock, isOutOfStock, isOverStock, orderRef, ownStock, reorderQty,
  roundStock, stockUnit,
} from '../core/data';

export type NoticeKind = 'stock' | 'order' | 'system';
export type NoticeLevel = 'danger' | 'warn' | 'info';

export interface Notice {
  /** Stable : une notice lue le reste tant que sa cause existe */
  id: string;
  kind: NoticeKind;
  level: NoticeLevel;
  title: string;
  text: string;
  link: string;
}

export interface NoticeInput {
  orders: Order[];
  products: Product[];
  fridge: FridgeItem[];
  settings: Settings;
  now: Date;
  online: boolean;
  error: string;
}

/** Une commande sans réponse depuis ce délai passe en urgence */
export const LATE_MINUTES = 30;

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function orderNotices(orders: Order[], now: Date): Notice[] {
  const today = localDay(now);
  return orders.flatMap((o): Notice[] => {
    const ref = orderRef(o.id);
    if (o.status === 'nouveau') {
      const minutes = o.createdAt ? Math.floor((now.getTime() - o.createdAt.getTime()) / 60000) : 0;
      const late = minutes >= LATE_MINUTES;
      return [{
        id: `order-${late ? 'late' : 'new'}-${o.id}`,
        kind: 'order',
        level: late ? 'danger' : 'warn',
        title: late ? `Commande ${ref} sans réponse` : `Nouvelle commande ${ref}`,
        text: late ? `${o.name} attend depuis ${minutes} min : confirmez sur WhatsApp.` : `${o.name} · ${o.typeLabel}`,
        link: '/admin/commandes',
      }];
    }
    if (['confirmé', 'prêt', 'en livraison'].includes(o.status) && o.date < today) {
      return [{
        id: `order-overdue-${o.id}`,
        kind: 'order',
        level: 'warn',
        title: `Commande ${ref} en retard`,
        text: `${o.name} : prévue le ${o.date}.`,
        link: '/admin/commandes',
      }];
    }
    return [];
  });
}

function stockNotices(products: Product[]): Notice[] {
  return products.flatMap((p): Notice[] => {
    const unit = stockUnit(p), refill = reorderQty(p);
    const buy = refill ? ` À racheter : ${refill} ${unit}.` : '';
    if (isOutOfStock(p)) {
      return [{
        id: `stock-out-${p.id}`, kind: 'stock', level: 'danger', link: '/admin/stock',
        title: `Rupture : ${p.name_fr}`,
        text: `${p.restockDate ? `Retour annoncé le ${p.restockDate}.` : 'Indiquez une date de retour pour les clients.'}${buy}`,
      }];
    }
    if (isLowStock(p)) {
      return [{
        id: `stock-low-${p.id}`, kind: 'stock', level: 'warn', link: '/admin/stock',
        title: `À remplir : ${p.name_fr}`,
        text: `Il reste ${roundStock(p.stock ?? 0)} ${unit}, le minimum est ${p.stockAlert}.${buy}`,
      }];
    }
    if (isOverStock(p)) {
      return [{
        id: `stock-over-${p.id}`, kind: 'stock', level: 'info', link: '/admin/stock',
        title: `Trop de stock : ${p.name_fr}`,
        text: `${roundStock(p.stock ?? 0)} ${unit}, le maximum est ${p.stockMax}.`,
      }];
    }
    return [];
  });
}

function fridgeNotices(fridge: FridgeItem[]): Notice[] {
  return fridge.filter(f => f.tracked).flatMap((f): Notice[] => {
    const kg = roundStock(f.kg);
    const left = `Il reste ${kg} kg, soit environ ${animals(f)} ${f.name.toLowerCase()}.`;
    const refill = f.max > kg ? roundStock(f.max - kg) : 0;
    const buy = refill ? ` À racheter : ${refill} kg, soit environ ${animals(f, refill)} ${f.name.toLowerCase()}.` : '';
    if (kg <= 0) {
      return [{
        id: `fridge-empty-${f.id}`, kind: 'stock', level: 'danger', link: '/admin/frigo',
        title: `Rupture : ${f.name}`,
        text: `${f.restockDate ? `Retour annoncé le ${f.restockDate}.` : 'Indiquez une date de retour pour les clients.'}${buy}`,
      }];
    }
    if (f.min && kg <= f.min) {
      return [{
        id: `fridge-low-${f.id}`, kind: 'stock', level: 'warn', link: '/admin/frigo',
        title: `À remplir : ${f.name}`, text: `${left}${buy}`,
      }];
    }
    if (f.max && kg > f.max) {
      return [{
        id: `fridge-over-${f.id}`, kind: 'stock', level: 'info', link: '/admin/frigo',
        title: `Trop de stock : ${f.name}`, text: `${kg} kg, le maximum est ${f.max} kg.`,
      }];
    }
    return [];
  });
}

function systemNotices({ products, fridge, settings, online, error }: NoticeInput): Notice[] {
  const list: Notice[] = [];
  const add = (id: string, level: NoticeLevel, title: string, text: string, link: string) =>
    list.push({ id: `system-${id}`, kind: 'system', level, title, text, link });

  if (!online) add('offline', 'danger', 'Pas de connexion internet', 'Les nouvelles commandes ne peuvent pas arriver.', '/admin/commandes');
  if (error) add('error', 'danger', 'Erreur Firebase', error, '/admin/commandes');
  if (settings.whatsapp === DEFAULT_SETTINGS.whatsapp) {
    add('whatsapp', 'danger', 'Numéro WhatsApp manquant', 'Le bouton WhatsApp du site et le rapport ne marcheront pas.', '/admin/parametres');
  }
  if (settings.phone === DEFAULT_SETTINGS.phone) {
    add('phone', 'warn', 'Téléphone manquant', 'Le site affiche encore un numéro provisoire.', '/admin/parametres');
  }
  if (products.length && !products.some(p => p.trackStock) && !fridge.some(f => f.tracked)) {
    add('stock-off', 'info', 'Stock non suivi', 'Activez le suivi pour recevoir les alertes de rupture.', '/admin/stock');
  }
  return list;
}

const RANK: Record<NoticeLevel, number> = { danger: 0, warn: 1, info: 2 };

/** Toutes les notifications du moment, les plus urgentes d'abord. */
export function buildNotices(input: NoticeInput): Notice[] {
  return [
    ...orderNotices(input.orders, input.now),
    ...stockNotices(ownStock(input.products, input.fridge)),
    ...fridgeNotices(input.fridge),
    ...systemNotices(input),
  ].sort((a, b) => RANK[a.level] - RANK[b.level]);
}
