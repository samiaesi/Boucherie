import { AuditEntry, auditCsv, auditSummary, describeChanges, entryLabel, filterEntries, orderEntries, trimDetail } from './audit';
import { Order } from './data';

const entry = (over: Partial<AuditEntry>): AuditEntry => ({
  id: '1', at: new Date('2026-11-05T10:00:00Z'), email: 'a@test.dz', role: 'admin', action: 'product.updated', target: 'Gigot', detail: 'stock : 10 → 8', ...over,
});

describe('describeChanges', () => {
  it('écrit les horaires en clair, seulement pour les jours modifiés', () => {
    const lundi = { day: 1, open: true, from: '07:00', to: '20:00' };
    const before = { schedule: [lundi, { day: 5, open: true, from: '07:00', to: '12:00' }] };
    const after = { schedule: [lundi, { day: 5, open: true, from: '07:00', to: '23:00' }] };
    expect(describeChanges(before, after)).toBe('vendredi : 07:00–12:00 → 07:00–23:00');
    expect(describeChanges(after, { schedule: [{ ...lundi, open: false }, after.schedule[1]] })).toBe('lundi : 07:00–20:00 → fermé');
  });

  it('résume une liste sans afficher son contenu technique', () => {
    expect(describeChanges({ closedDays: [] }, { closedDays: [{ date: '2026-12-01', reason: 'x' }] })).toBe('jours de fermeture : modifié');
  });

  it('ne garde que ce qui change', () => {
    expect(describeChanges({ stock: 1000, stockAlert: 200, name: 'Poulet' }, { stock: 0, stockAlert: 200, name: 'Poulet' })).toBe('stock : 1000 → 0');
  });

  it('accepte une nouvelle valeur sans ancienne version', () => {
    expect(describeChanges(undefined, { price: 2800 })).toBe('price : — → 2800');
  });

  it('ne recopie jamais le contenu d\'une photo', () => {
    expect(describeChanges({ heroImage: 'a' }, { heroImage: 'data:image/jpeg;base64,AAAA' })).toBe('heroImage : photo modifiée');
  });

  it('coupe les détails trop longs', () => {
    expect(trimDetail('x'.repeat(600))).toHaveLength(481);
  });
});

describe('orderEntries', () => {
  it('transforme une commande du site en ligne de journal', () => {
    const at = new Date();
    const [line] = orderEntries([{ id: 'abcdefgh', name: 'Karim', tel: '0555', typeLabel: 'Panier', createdAt: at } as Order]);
    expect([line.action, line.at, line.email]).toEqual(['order.created', at, '']);
    expect(line.detail).toContain('Karim');
  });

  it('ignore une commande sans date', () => {
    expect(orderEntries([{ id: 'x' } as Order])).toEqual([]);
  });
});

describe('filterEntries', () => {
  const entries = [entry({}), entry({ id: '2', email: 'b@test.dz', action: 'invoice.deleted', target: 'FA-2026-0001', detail: 'Client' })];

  it('filtre par catégorie, utilisateur et texte', () => {
    expect(filterEntries(entries, { category: 'Factures', user: '', text: '' }).map(e => e.id)).toEqual(['2']);
    expect(filterEntries(entries, { category: '', user: 'a@test.dz', text: '' }).map(e => e.id)).toEqual(['1']);
    expect(filterEntries(entries, { category: '', user: '', text: 'fa-2026' }).map(e => e.id)).toEqual(['2']);
  });
});

describe('Rapport', () => {
  it('compte les actions par catégorie', () => {
    const summary = auditSummary([entry({}), entry({ id: '2' }), entry({ id: '3', action: 'login' })]);
    expect(summary).toEqual([{ category: 'Catalogue', count: 2 }, { category: 'Connexion', count: 1 }]);
  });

  it('exporte un fichier lisible par Excel et neutralise les formules', () => {
    const csv = auditCsv([entry({ detail: '=HYPERLINK("x")' })], () => '05/11/2026');
    expect(csv.startsWith('﻿"Date";')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('garde un libellé même pour une action inconnue', () => {
    expect(entryLabel(entry({ action: 'autre' as never }))).toBe('autre');
  });
});
