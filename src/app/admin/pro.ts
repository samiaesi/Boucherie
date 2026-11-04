import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { formatNumber } from '../core/data';
import { Company, PAYMENT_MODES, PaymentMode, ProLine, computePro, lineHt } from '../core/pro-invoice';
import { AdminData } from './admin-data';

const blankCompany = (): Omit<Company, 'id'> => ({ name: '', nif: '', nis: '', rc: '', ai: '', address: '', tel: '', contact: '' });
const blankLine = (vatRate: number): ProLine => ({ productId: '', label: '', qty: 1, unit: 'kg', priceHt: 0, vatRate });
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

@Component({
  selector: 'app-pro',
  imports: [FormsModule],
  template: `
    <div class="head">
      <h2>Facturation entreprises</h2>
      <div class="chips">
        <button class="chip" [class.active]="tab() === 'new'" (click)="tab.set('new')">Nouvelle facture</button>
        <button class="chip" [class.active]="tab() === 'clients'" (click)="tab.set('clients')">Clients ({{ companies().length }})</button>
      </div>
    </div>

    @if (tab() === 'new') {
      @if (!companies().length) {
        <div class="empty">Ajoutez d'abord un client dans l'onglet Clients.</div>
      } @else {
        <form class="card-box wide" #f="ngForm" (ngSubmit)="issue(f)">
          <div class="grid2">
            <label>Client
              <select name="company" required [ngModel]="companyId()" (ngModelChange)="companyId.set($event)">
                <option value="">Choisir…</option>
                @for (c of companies(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
              </select>
            </label>
            <label>Date de facture<input name="date" type="date" required [(ngModel)]="date"></label>
            <label>Paiement
              <select name="payment" [ngModel]="payment()" (ngModelChange)="payment.set($event)">
                @for (m of modes; track m) { <option [value]="m">{{ m }}</option> }
              </select>
            </label>
            <label>Échéance<input name="dueDate" type="date" [(ngModel)]="dueDate"></label>
          </div>

          <div class="lines">
            <div class="line head-line"><span>Article</span><span>Quantité</span><span>Unité</span><span>Prix HT</span><span>TVA %</span><span>Total HT</span><span></span></div>
            @for (l of lines(); track l; let i = $index) {
              <div class="line">
                <span class="article">
                  <select [name]="'p' + i" aria-label="Produit" [ngModel]="l.productId" (ngModelChange)="pick(l, $event)">
                    <option value="">Article libre</option>
                    @for (p of data.products(); track p.id) { <option [value]="p.id">{{ p.name_fr }}</option> }
                  </select>
                  <input [name]="'l' + i" required placeholder="Désignation" aria-label="Désignation" [(ngModel)]="l.label">
                </span>
                <input [name]="'q' + i" type="number" min="0" step="0.01" required aria-label="Quantité" [ngModel]="l.qty" (ngModelChange)="set(l, 'qty', $event)">
                <input [name]="'u' + i" aria-label="Unité" [(ngModel)]="l.unit">
                <input [name]="'h' + i" type="number" min="0" step="0.01" required aria-label="Prix HT" [ngModel]="l.priceHt" (ngModelChange)="set(l, 'priceHt', $event)">
                <input [name]="'v' + i" type="number" min="0" aria-label="TVA" [ngModel]="l.vatRate" (ngModelChange)="set(l, 'vatRate', $event)">
                <b>{{ num(ht(l)) }}</b>
                <button type="button" class="btn danger small" [disabled]="lines().length === 1" (click)="removeLine(i)">✕</button>
              </div>
            }
            <div><button type="button" class="btn light small" (click)="addLine()">+ Ajouter une ligne</button></div>
          </div>

          <div class="bottom">
            <div class="options">
              <label>Remise (%)<input name="discount" type="number" min="0" max="100" [ngModel]="discount()" (ngModelChange)="discount.set(+$event || 0)"></label>
              <label class="check"><input type="checkbox" name="deduct" [(ngModel)]="deductStock"> Déduire du stock</label>
            </div>
            <div class="totals">
              @if (totals().discount) {
                <div><span>Total brut</span><b>{{ num(totals().totalHtBrut) }} DA</b></div>
                <div><span>Remise</span><b>- {{ num(totals().discount) }} DA</b></div>
              }
              <div><span>Total HT</span><b>{{ num(totals().totalHt) }} DA</b></div>
              @for (v of totals().vat; track v.rate) { <div><span>TVA {{ v.rate }} %</span><b>{{ num(v.amount) }} DA</b></div> }
              @if (totals().stamp) { <div><span>Timbre</span><b>{{ num(totals().stamp) }} DA</b></div> }
              <div class="grand"><span>Total TTC</span><b>{{ num(totals().ttc) }} DA</b></div>
            </div>
          </div>

          @if (error()) { <div class="msg">{{ error() }}</div> }
          <div><button class="btn" type="submit" [disabled]="f.invalid || busy()">{{ busy() ? 'Création…' : 'Émettre la facture' }}</button></div>
        </form>
      }
    } @else {
      <div class="items">
        @for (c of companies(); track c.id) {
          <div class="item">
            <div class="info"><b>{{ c.name }}</b><small>NIF {{ c.nif || '—' }} · {{ c.tel || 'Sans téléphone' }}</small></div>
            <div class="item-actions">
              <button class="btn light small" (click)="edit(c)">Modifier</button>
              <button class="btn danger small" (click)="removeCompany(c)">✕</button>
            </div>
          </div>
        }
      </div>
      <form class="card-box client-form" #cf="ngForm" (ngSubmit)="saveCompany(cf)">
        <h3>{{ editingId ? 'Modifier le client' : 'Nouveau client' }}</h3>
        <div class="grid2">
          <label>Raison sociale<input name="name" required [(ngModel)]="company.name"></label>
          <label>Contact<input name="contact" [(ngModel)]="company.contact"></label>
          <label>NIF<input name="nif" [(ngModel)]="company.nif"></label>
          <label>NIS<input name="nis" [(ngModel)]="company.nis"></label>
          <label>RC<input name="rc" [(ngModel)]="company.rc"></label>
          <label>AI<input name="ai" [(ngModel)]="company.ai"></label>
          <label>Adresse<input name="address" [(ngModel)]="company.address"></label>
          <label>Téléphone<input name="tel" type="tel" [(ngModel)]="company.tel"></label>
        </div>
        <div><button class="btn" type="submit" [disabled]="cf.invalid">Enregistrer</button></div>
      </form>
    }
  `,
  styles: `
    .wide { max-width: none; }
    .lines { display: grid; gap: 8px; }
    .line { display: grid; grid-template-columns: 2.4fr 90px 80px 110px 70px 110px auto; gap: 8px; align-items: center; }
    .head-line { font-size: .8rem; font-weight: 600; color: var(--muted); }
    .article { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .line b { text-align: end; }
    .bottom { display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
    .options { display: grid; gap: 10px; align-content: start; width: 200px; }
    .totals { min-width: 280px; }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
    .totals .grand { margin-top: 4px; padding-top: 8px; border-top: 2px solid var(--ink); font-size: 1.15rem; }
    .client-form { margin-top: 18px; }
    .client-form h3 { font-family: Inter, sans-serif; font-size: 1.05rem; }
    @media (max-width: 800px) {
      .head-line { display: none; }
      .line { grid-template-columns: 1fr 1fr; padding-bottom: 8px; border-bottom: 1px dashed var(--line); }
      .article { grid-column: 1 / -1; }
    }
  `,
})
export class Pro implements OnInit {
  protected readonly data = inject(AdminData);
  protected readonly tab = signal<'new' | 'clients'>('new');
  protected readonly companies = signal<Company[]>([]);
  protected readonly companyId = signal('');
  protected readonly payment = signal<PaymentMode>('virement');
  protected readonly discount = signal(0);
  protected readonly lines = signal<ProLine[]>([blankLine(this.data.settings().vatRate)]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly modes = PAYMENT_MODES;
  protected readonly num = formatNumber;
  protected readonly ht = lineHt;
  protected date = today();
  protected dueDate = '';
  protected deductStock = true;
  protected company = blankCompany();
  protected editingId: string | null = null;

  protected readonly totals = computed(() =>
    computePro(this.lines(), this.discount(), this.payment(), this.data.settings().stampRate));

  async ngOnInit() {
    await this.reload();
  }

  private async reload() {
    this.companies.set(await this.data.listCompanies());
  }

  /** Nouvelle copie de la liste : les totaux se recalculent */
  private touch() {
    this.lines.update(l => [...l]);
  }

  protected set(line: ProLine, key: 'qty' | 'priceHt' | 'vatRate', value: number) {
    line[key] = Number(value) || 0;
    this.touch();
  }

  protected pick(line: ProLine, productId: string) {
    line.productId = productId;
    const p = this.data.products().find(x => x.id === productId);
    if (p) {
      line.label = p.name_fr;
      line.priceHt = p.price;
      line.unit = p.unit === 'kg' ? 'kg' : 'pièce';
    }
    this.touch();
  }

  protected addLine() {
    this.lines.update(l => [...l, blankLine(this.data.settings().vatRate)]);
  }

  protected removeLine(i: number) {
    this.lines.update(l => l.filter((_, n) => n !== i));
  }

  protected async issue(form: NgForm) {
    const client = this.companies().find(c => c.id === this.companyId());
    if (!client) return;
    this.busy.set(true);
    this.error.set('');
    const win = window.open('', '_blank');
    try {
      const { id: _, ...details } = client;
      const id = await this.data.createProInvoice({
        client: details, lines: this.lines(), discountRate: this.discount(), payment: this.payment(),
        date: this.date, dueDate: this.dueDate, deductStock: this.deductStock,
      });
      if (win) win.location.href = `/facture/${id}`;
      this.data.notify('Facture émise');
      form.resetForm({ company: '', date: today(), payment: 'virement', dueDate: '', discount: 0, deduct: true });
      this.companyId.set('');
      this.payment.set('virement');
      this.discount.set(0);
      this.lines.set([blankLine(this.data.settings().vatRate)]);
    } catch (e) {
      win?.close();
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected edit(c: Company) {
    const { id, ...rest } = c;
    this.editingId = id;
    this.company = rest;
  }

  protected async saveCompany(form: NgForm) {
    await this.data.saveCompany(this.editingId, this.company);
    this.data.notify('Client enregistré');
    this.editingId = null;
    this.company = blankCompany();
    form.resetForm(blankCompany());
    await this.reload();
  }

  protected async removeCompany(c: Company) {
    if (!confirm(`Supprimer le client ${c.name} ? Ses factures sont conservées.`)) return;
    await this.data.removeCompany(c.id);
    await this.reload();
  }
}
