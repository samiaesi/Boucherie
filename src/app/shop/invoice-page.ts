import { Component, ElementRef, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore';
import { formatNumber } from '../core/data';
import { db } from '../core/firebase';
import { Invoice, InvoiceLine, vatPart } from '../core/invoice';
import { lineHt } from '../core/pro-invoice';
import { Shop } from '../core/shop';

const LABELS = {
  fr: {
    invoice: 'Facture', date: 'Date', client: 'Client', tel: 'Téléphone', address: 'Adresse', mode: 'Réception',
    pickup: 'Retrait à la boucherie', delivery: 'Livraison', article: 'Article', qty: 'Qté', total: 'Total',
    subtotal: 'Sous-total', free: 'Gratuite', vat: 'dont TVA', cancelled: 'Facture annulée', currency: 'DA',
    pay: 'Paiement à la réception de la commande.', download: 'Télécharger le PDF', share: 'Envoyer le PDF', working: 'Préparation du PDF…',
    missing: 'Facture introuvable.', thanks: 'Merci de votre confiance !',
  },
  ar: {
    invoice: 'فاتورة', date: 'التاريخ', client: 'الزبون', tel: 'الهاتف', address: 'العنوان', mode: 'الاستلام',
    pickup: 'الاستلام من الجزارة', delivery: 'التوصيل', article: 'المنتج', qty: 'الكمية', total: 'المجموع',
    subtotal: 'المجموع الفرعي', free: 'مجاني', vat: 'منها الضريبة', cancelled: 'فاتورة ملغاة', currency: 'دج',
    pay: 'الدفع عند استلام الطلب.', download: 'تحميل PDF', share: 'إرسال PDF', working: 'جارٍ تحضير الملف…',
    missing: 'الفاتورة غير موجودة.', thanks: 'شكراً لثقتكم!',
  },
};

const A4_WIDTH_PX = 794;

/** Page publique de la facture : l'identifiant du lien, impossible à deviner, en est la clé. */
@Component({
  selector: 'app-invoice-page',
  template: `
    @if (invoice(); as inv) {
      <div class="bar">
        <button (click)="download()" [disabled]="busy()">{{ busy() ? l().working : l().download }}</button>
        @if (canShare) { <button class="wa" (click)="share()" [disabled]="busy()">{{ l().share }}</button> }
      </div>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <article #sheet class="sheet" [attr.dir]="inv.lang === 'ar' ? 'rtl' : 'ltr'">
        <header>
          <div class="brand">
            <img src="logo.svg" alt="">
            <div>
              <b>{{ inv.seller.name }}</b>
              <small>{{ inv.seller.company }}</small>
              <small>{{ inv.seller.address }}</small>
              <small dir="ltr">{{ inv.seller.phone }}</small>
            </div>
          </div>
          <div class="title">
            <h1>{{ l().invoice }}</h1>
            <b>{{ inv.number }}</b>
            <small>{{ l().date }} : {{ inv.date }}</small>
          </div>
        </header>
        @if (inv.status === 'annulée') { <p class="cancelled">{{ l().cancelled }}</p> }

        @if (inv.pro; as pro) {
          <section class="client">
            <div><small>Client</small><b>{{ pro.client.name }}</b>@if (pro.client.address) { <small>{{ pro.client.address }}</small> }</div>
            @for (id of clientIds(); track id[0]) { <div><small>{{ id[0] }}</small><b>{{ id[1] }}</b></div> }
          </section>
          <table>
            <thead><tr><th>Désignation</th><th>Qté</th><th>Unité</th><th>Prix HT</th><th>TVA</th><th>Total HT</th></tr></thead>
            <tbody>
              @for (line of pro.lines; track $index) {
                <tr>
                  <td>{{ line.label }}</td><td>{{ num(line.qty) }}</td><td>{{ line.unit }}</td>
                  <td>{{ num(line.priceHt) }}</td><td>{{ line.vatRate }} %</td><td>{{ num(ht(line)) }}</td>
                </tr>
              }
            </tbody>
          </table>
          <div class="totals">
            @if (pro.discount) {
              <div><span>Total brut</span><b>{{ money(pro.totalHtBrut) }}</b></div>
              <div><span>Remise {{ pro.discountRate }} %</span><b>- {{ money(pro.discount) }}</b></div>
            }
            <div><span>Total HT</span><b>{{ money(pro.totalHt) }}</b></div>
            @for (v of pro.vat; track v.rate) { <div><span>TVA {{ v.rate }} %</span><b>{{ money(v.amount) }}</b></div> }
            @if (pro.stamp) { <div><span>Timbre</span><b>{{ money(pro.stamp) }}</b></div> }
            <div class="grand"><span>Total TTC</span><b>{{ money(pro.ttc) }}</b></div>
          </div>
          <p class="words">Arrêtée la présente facture à la somme de : <b>{{ pro.amountWords }}</b>.</p>
          <div class="terms">
            <span>Mode de paiement : <b>{{ pro.payment }}</b></span>
            @if (pro.dueDate) { <span>Échéance : <b>{{ pro.dueDate }}</b></span> }
          </div>
          <div class="sign"><span>Cachet et signature</span></div>
        } @else {
        <section class="client">
          <div><small>{{ l().client }}</small><b>{{ inv.customer.name }}</b></div>
          <div><small>{{ l().tel }}</small><b dir="ltr">{{ inv.customer.tel }}</b></div>
          <div><small>{{ l().mode }}</small><b>{{ inv.delivery ? l().delivery : l().pickup }}</b></div>
          @if (inv.customer.address) { <div><small>{{ l().address }}</small><b>{{ inv.customer.address }}</b></div> }
        </section>

        <table>
          <thead><tr><th>{{ l().article }}</th><th>{{ l().qty }}</th><th>{{ l().total }}</th></tr></thead>
          <tbody>
            @for (line of inv.lines; track $index) {
              <tr>
                <td class="item">
                  @if (imageOf(line); as src) { <img [src]="src" crossorigin="anonymous" alt=""> }
                  <div><b>{{ inv.lang === 'ar' ? (line.name_ar || line.name_fr) : line.name_fr }}</b><small>{{ line.detail }}</small></div>
                </td>
                <td>{{ line.qty }}</td>
                <td>{{ money(line.total) }}</td>
              </tr>
            }
          </tbody>
        </table>

        <div class="totals">
          <div><span>{{ l().subtotal }}</span><b>{{ money(inv.subtotal) }}</b></div>
          @if (inv.delivery) {
            <div><span>{{ l().delivery }}</span><b>{{ inv.deliveryFee ? money(inv.deliveryFee) : l().free }}</b></div>
          }
          @if (vat()) { <div><span>{{ l().vat }} ({{ inv.vatRate }}%)</span><b>{{ money(vat()) }}</b></div> }
          <div class="grand"><span>{{ l().total }}</span><b>{{ money(inv.total) }}</b></div>
        </div>
        }

        <footer>
          @if (legal()) { <small dir="ltr">{{ legal() }}</small> }
          @if (!inv.pro) { <p>{{ l().pay }} {{ l().thanks }}</p> }
        </footer>
      </article>
    } @else if (loaded()) {
      <p class="missing">{{ labels.fr.missing }}</p>
    }
  `,
  styles: `
    :host { display: block; min-height: 100vh; padding: 16px; background: #efe9e1; font-family: Inter, Cairo, system-ui, sans-serif; color: #1d1613; }
    .bar { display: flex; gap: 10px; justify-content: center; margin-bottom: 14px; flex-wrap: wrap; }
    .bar button { padding: 12px 22px; border: 0; border-radius: 999px; background: #d0102a; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    .bar button.wa { background: #25d366; color: #0b3b1e; }
    .bar button:disabled { opacity: .6; }
    .err { text-align: center; color: #a10c20; }
    .sheet { max-width: 794px; margin: 0 auto; padding: 32px; background: #fff; }
    header { display: flex; justify-content: space-between; gap: 20px; padding-bottom: 18px; border-bottom: 3px solid #d0102a; flex-wrap: wrap; }
    .brand { display: flex; gap: 12px; }
    .brand img { width: 74px; height: 74px; }
    .brand b { font-size: 1.2rem; }
    small { display: block; color: #6b5f58; }
    .title { text-align: end; }
    .title h1 { margin: 0; font-size: 1.7rem; color: #d0102a; }
    .cancelled { margin: 14px 0 0; padding: 10px; background: #fde8ea; color: #a10c20; font-weight: 700; text-align: center; }
    .client { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 18px 0; padding: 14px; background: #faf5ef; }
    .client b { display: block; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 9px 8px; background: #1d1613; color: #fff; text-align: start; font-size: .85rem; }
    td { padding: 9px 8px; border-bottom: 1px solid #efe6dc; }
    th:not(:first-child), td:not(:first-child) { text-align: end; white-space: nowrap; }
    .item { display: flex; align-items: center; gap: 10px; }
    .item img { width: 58px; height: 58px; object-fit: cover; flex: none; }
    .totals { margin-top: 16px; margin-inline-start: auto; width: min(300px, 100%); }
    .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
    .totals .grand { margin-top: 6px; padding-top: 10px; border-top: 2px solid #1d1613; font-size: 1.25rem; color: #d0102a; }
    .words { margin: 18px 0 8px; }
    .terms { display: flex; gap: 24px; flex-wrap: wrap; }
    .sign { display: flex; justify-content: flex-end; margin-top: 26px; min-height: 90px; color: #6b5f58; }
    footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #efe6dc; text-align: center; }
    footer p { margin: 6px 0 0; color: #6b5f58; }
    .missing { text-align: center; padding: 60px 0; }
    @media print { :host { padding: 0; background: #fff; } .bar { display: none; } }
  `,
})
export class InvoicePage implements OnInit {
  private readonly shop = inject(Shop);
  /** Paramètre de route :id */
  readonly id = input.required<string>();
  private readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');
  protected readonly labels = LABELS;
  protected readonly invoice = signal<Invoice | null>(null);
  protected readonly loaded = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly canShare = typeof navigator.canShare === 'function';

  protected readonly l = computed(() => LABELS[this.invoice()?.lang ?? 'fr']);
  protected readonly vat = computed(() => {
    const inv = this.invoice();
    return inv ? vatPart(inv.total, inv.vatRate) : 0;
  });
  protected readonly legal = computed(() => {
    const s = this.invoice()?.seller;
    if (!s) return '';
    return [['NIF', s.nif], ['NIS', s.nis], ['RC', s.rc], ['AI', s.ai]]
      .filter(([, v]) => v).map(([k, v]) => `${k} : ${v}`).join(' · ');
  });

  async ngOnInit() {
    this.shop.load();
    try {
      const snap = await getDoc(doc(db, 'invoices', this.id()));
      if (snap.exists()) this.invoice.set({ ...snap.data(), id: snap.id } as Invoice);
    } catch (e) {
      console.warn('Facture illisible', e);
    }
    this.loaded.set(true);
  }

  protected readonly num = formatNumber;
  protected readonly ht = lineHt;

  protected clientIds() {
    const c = this.invoice()?.pro?.client;
    return (c ? [['NIF', c.nif], ['NIS', c.nis], ['RC', c.rc], ['AI', c.ai]] : []).filter(([, v]) => v);
  }

  protected money(n: number) {
    return `${formatNumber(n)} ${this.l().currency}`;
  }

  protected imageOf(line: InvoiceLine) {
    return this.shop.products().find(p => p.id === line.productId)?.image;
  }

  private async makePdf(): Promise<File> {
    const el = this.sheet()!.nativeElement;
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
    // Rendu en largeur A4, même depuis un téléphone
    const width = el.style.width;
    el.style.width = `${A4_WIDTH_PX}px`;
    el.style.maxWidth = 'none';
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: A4_WIDTH_PX + 40 });
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      const image = canvas.toDataURL('image/jpeg', 0.85);
      for (let top = 0, page = 0; top < imgH; top += pageH, page++) {
        if (page) pdf.addPage();
        pdf.addImage(image, 'JPEG', 0, -top, pageW, imgH);
      }
      return new File([pdf.output('blob')], `${this.invoice()!.number}.pdf`, { type: 'application/pdf' });
    } finally {
      el.style.width = width;
      el.style.maxWidth = '';
    }
  }

  private async withPdf(use: (file: File) => Promise<void> | void) {
    this.busy.set(true);
    this.error.set('');
    try {
      await use(await this.makePdf());
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        console.error('PDF impossible', e);
        this.error.set('PDF');
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected download() {
    return this.withPdf(file => {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  /** Sur téléphone : ouvre le partage du système, d'où on choisit WhatsApp. */
  protected share() {
    return this.withPdf(async file => {
      if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: file.name });
      else await this.download();
    });
  }
}
