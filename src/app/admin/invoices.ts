import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatNumber } from '../core/data';
import { Invoice } from '../core/invoice';
import { paymentState, round2 } from '../core/pro-invoice';
import { AdminData } from './admin-data';
import { Auth } from './auth';

@Component({
  selector: 'app-invoices',
  imports: [FormsModule],
  template: `
    <div class="head">
      <h2>Factures</h2>
      <input class="search" placeholder="Numéro, client ou téléphone" [ngModel]="query()" (ngModelChange)="query.set($event)">
    </div>
    <div class="stats">
      <div class="stat"><b>{{ valid().length }}</b><span>Factures émises</span></div>
      <div class="stat"><b>{{ num(month()) }} DA</b><span>Ce mois-ci</span></div>
      <div class="stat"><b>{{ num(unpaid()) }} DA</b><span>Reste à encaisser (entreprises)</span></div>
    </div>
    <div class="items">
      @for (i of shown(); track i.id) {
        <div class="item" [class.off]="i.status === 'annulée'">
          <div class="info">
            <b>{{ i.number }}
              @if (i.status === 'annulée') { <span class="pill alert">Annulée</span> }
              @else if (state(i); as s) { <span class="pill" [class.alert]="s === 'en retard'" [class.warn]="s === 'partielle' || s === 'impayée'">{{ s }}</span> }
            </b>
            <small>{{ i.date }} · {{ i.customer.name }} · {{ i.customer.tel }}</small>
          </div>
          <div class="price">{{ num(i.total) }} DA</div>
          @if (i.pro && i.status !== 'annulée' && canManage()) {
            <button class="btn light small" (click)="pay(i)">Encaisser</button>
            <button class="btn danger small" (click)="cancel(i)">Annuler</button>
          }
          <a class="btn light small" target="_blank" [href]="'/facture/' + i.id">Ouvrir</a>
        </div>
      } @empty {
        @if (loaded()) { <div class="empty">Aucune facture. Elles sont créées à la confirmation des commandes.</div> }
      }
    </div>
  `,
  styles: `.search { max-width: 280px; }`,
})
export class Invoices implements OnInit {
  private readonly data = inject(AdminData);
  private readonly auth = inject(Auth);
  private readonly list = signal<Invoice[]>([]);
  protected readonly loaded = signal(false);
  protected readonly query = signal('');
  protected readonly num = formatNumber;
  protected readonly valid = computed(() => this.list().filter(i => i.status !== 'annulée'));

  protected readonly month = computed(() => {
    const prefix = new Date().toISOString().slice(0, 7);
    return this.valid().filter(i => i.date.startsWith(prefix)).reduce((sum, i) => sum + i.total, 0);
  });

  protected readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.list().filter(i => !q || `${i.number} ${i.customer.name} ${i.customer.tel}`.toLowerCase().includes(q));
  });

  protected readonly unpaid = computed(() => round2(this.valid().reduce((sum, i) => sum + (i.pro ? i.pro.ttc - i.pro.paid : 0), 0)));

  async ngOnInit() {
    await this.reload();
    this.loaded.set(true);
  }

  private async reload() {
    this.list.set(await this.data.listInvoices());
  }

  protected canManage() {
    return this.auth.role() !== 'commandes';
  }

  protected state(i: Invoice) {
    const d = new Date();
    return paymentState(i, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  protected async pay(i: Invoice) {
    const left = round2(i.pro!.ttc - i.pro!.paid);
    const answer = prompt(`Montant encaissé pour ${i.number} (reste ${formatNumber(left)} DA)`, String(left));
    const amount = Number((answer ?? '').replace(',', '.'));
    if (!(amount > 0)) return;
    await this.data.setPaid(i, round2(i.pro!.paid + amount));
    this.data.notify('Paiement enregistré');
    await this.reload();
  }

  protected async cancel(i: Invoice) {
    if (!confirm(`Annuler la facture ${i.number} ? Elle restera dans la liste, marquée annulée.`)) return;
    await this.data.cancelProInvoice(i);
    this.data.notify('Facture annulée');
    await this.reload();
  }
}
