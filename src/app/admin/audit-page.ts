import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AUDIT_ACTIONS, AuditEntry, auditCsv, auditSummary, entryCategory, entryLabel, filterEntries, orderEntries } from '../core/audit';
import { localDay } from '../core/stats';
import { AdminData } from './admin-data';

const DAYS_SHOWN = 30;
const when = (d: Date) => d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Algiers' });

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDay(d);
}

@Component({
  selector: 'app-audit',
  imports: [FormsModule],
  template: `
    <div class="head no-print">
      <h2>Rapport d'audit</h2>
      <div class="tools">
        <button class="btn light small" (click)="exportCsv()" [disabled]="!shown().length">Exporter (Excel)</button>
        <button class="btn small" (click)="print()" [disabled]="!shown().length">Imprimer</button>
      </div>
    </div>

    <div class="print-only">
      <h1>Rapport d'audit — {{ data.settings().name_fr }}</h1>
      <p>{{ data.settings().company }} · Période du {{ from() }} au {{ to() }} · Édité le {{ today }}</p>
    </div>

    <div class="filters no-print">
      <label>Du<input type="date" [ngModel]="from()" (ngModelChange)="from.set($event); reload()" name="from"></label>
      <label>Au<input type="date" [ngModel]="to()" (ngModelChange)="to.set($event); reload()" name="to"></label>
      <label>Catégorie
        <select [ngModel]="category()" (ngModelChange)="category.set($event)" name="category">
          <option value="">Toutes</option>
          @for (c of categories; track c) { <option [value]="c">{{ c }}</option> }
        </select>
      </label>
      <label>Utilisateur
        <select [ngModel]="user()" (ngModelChange)="user.set($event)" name="user">
          <option value="">Tous</option>
          @for (u of users(); track u) { <option [value]="u">{{ u }}</option> }
        </select>
      </label>
      <label class="wide">Recherche<input type="search" placeholder="Commande, facture, produit…" [ngModel]="text()" (ngModelChange)="text.set($event)" name="text"></label>
    </div>

    <div class="summary">
      <div class="stat"><b>{{ shown().length }}</b><span>Actions</span></div>
      @for (s of summary(); track s.category) { <div class="stat"><b>{{ s.count }}</b><span>{{ s.category }}</span></div> }
    </div>

    @if (error()) { <div class="msg">{{ error() }}</div> }

    <div class="table">
      <div class="row titles"><span>Date</span><span>Utilisateur</span><span>Action</span><span>Objet</span><span>Détail</span></div>
      @for (e of shown(); track e.id) {
        <div class="row" [class.alert]="isDelete(e)">
          <span class="date">{{ when(e.at) }}</span>
          <span class="who">{{ e.email || 'Site' }}<small>{{ e.role }}</small></span>
          <span><b>{{ label(e) }}</b><small>{{ category$(e) }}</small></span>
          <span>{{ e.target }}</span>
          <span class="detail">{{ e.detail }}</span>
        </div>
      } @empty {
        @if (loaded()) { <div class="empty">Aucune action sur cette période.</div> }
      }
    </div>
    @if (capped()) { <p class="hint">Seules les 2000 dernières actions sont affichées : réduisez la période.</p> }
  `,
  styles: `
    .tools { display: flex; gap: 8px; }
    .filters { display: grid; grid-template-columns: 150px 150px 170px 220px minmax(180px, 1fr); gap: 10px; margin-bottom: 14px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 14px; }
    .summary .stat b { font-size: 1.35rem; }
    .table { background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
    .row { display: grid; grid-template-columns: 125px 190px 190px 130px minmax(180px, 1fr); gap: 12px; padding: 9px 14px; border-top: 1px solid var(--line); font-size: .86rem; overflow-wrap: anywhere; }
    .row:first-child { border-top: 0; }
    .row.alert { background: #fdf3f3; }
    .row small { display: block; color: var(--muted); font-size: .76rem; }
    .titles { background: var(--bg); color: var(--muted); font-size: .78rem; font-weight: 600; }
    .date { white-space: nowrap; }
    .hint { margin-top: 10px; color: var(--muted); font-size: .85rem; }
    .print-only { display: none; }
    @media (max-width: 900px) {
      .filters { grid-template-columns: 1fr 1fr; }
      .filters .wide { grid-column: 1 / -1; }
      .titles { display: none; }
      .row { grid-template-columns: 1fr; gap: 2px; }
    }
    @media print {
      .no-print { display: none !important; }
      .print-only { display: block; margin-bottom: 14px; }
      .print-only h1 { font-size: 16pt; }
      .table { border: 0; border-radius: 0; overflow: visible; }
      .row { grid-template-columns: 90px 130px 120px 80px 1fr; padding: 4px 0; font-size: 8pt; break-inside: avoid; }
      .summary .stat { padding: 4px 8px; }
    }
  `,
})
export class Audit implements OnInit {
  protected readonly data = inject(AdminData);
  protected readonly when = when;
  protected readonly today = when(new Date());
  protected readonly label = entryLabel;
  protected readonly category$ = entryCategory;
  protected readonly categories = [...new Set(Object.values(AUDIT_ACTIONS).map(a => a.category))];
  protected readonly from = signal(daysAgo(DAYS_SHOWN));
  protected readonly to = signal(localDay(new Date()));
  protected readonly category = signal('');
  protected readonly user = signal('');
  protected readonly text = signal('');
  protected readonly loaded = signal(false);
  protected readonly error = signal('');
  protected readonly capped = signal(false);
  private readonly logged = signal<AuditEntry[]>([]);

  private readonly entries = computed(() => {
    const start = new Date(`${this.from()}T00:00`), end = new Date(`${this.to()}T23:59:59`);
    const orders = orderEntries(this.data.orders()).filter(e => e.at >= start && e.at <= end);
    return [...this.logged(), ...orders].sort((a, b) => b.at.getTime() - a.at.getTime());
  });

  protected readonly users = computed(() => [...new Set(this.entries().map(e => e.email).filter(Boolean))].sort());
  protected readonly shown = computed(() => filterEntries(this.entries(), { category: this.category(), user: this.user(), text: this.text() }));
  protected readonly summary = computed(() => auditSummary(this.shown()));

  ngOnInit() {
    return this.reload();
  }

  protected async reload() {
    if (!this.from() || !this.to()) return;
    this.error.set('');
    try {
      const list = await this.data.listAudit(new Date(`${this.from()}T00:00`), new Date(`${this.to()}T23:59:59`));
      this.logged.set(list.entries);
      this.capped.set(list.capped);
    } catch (e) {
      this.error.set(`Journal indisponible : ${(e as Error).message}`);
    }
    this.loaded.set(true);
  }

  protected isDelete(e: AuditEntry) {
    return e.action.endsWith('.deleted');
  }

  protected print() {
    window.print();
  }

  protected exportCsv() {
    const url = URL.createObjectURL(new Blob([auditCsv(this.shown(), when)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-${this.from()}-${this.to()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
