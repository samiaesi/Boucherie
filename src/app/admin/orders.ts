import { shopOrigin } from './admin-app';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Order, OrderStatus, STATUSES, orderRef } from '../core/data';
import { Shop } from '../core/shop';
import { specialReadyTime } from '../core/ordering';
import { canDelete } from './roles';
import { AdminData } from './admin-data';
import { Auth } from './auth';

type Filter = 'actives' | 'toutes' | OrderStatus;

@Component({
  selector: 'app-orders',
  imports: [DatePipe, RouterLink, TitleCasePipe],
  template: `
    <div class="stats">
      <div class="stat"><b>{{ count('nouveau') }}</b><span>Nouvelles commandes</span></div>
      <div class="stat"><b>{{ today() }}</b><span>À retirer aujourd'hui</span></div>
      <div class="stat"><b>{{ count('prêt') }}</b><span>Prêtes</span></div>
      <div class="stat"><b>{{ data.orders().length }}</b><span>Total</span></div>
    </div>
    <div class="head">
      <h2>Commandes</h2>
      <div class="chips">
        @for (f of filters; track f) {
          <button class="chip" [class.active]="f === filter()" (click)="filter.set(f)">{{ f | titlecase }}</button>
        }
      </div>
    </div>
    <div class="orders">
      @for (o of shown(); track o.id) {
        <article class="order" [class]="o.status">
          <div>
            <h3>{{ o.name }} · {{ o.typeLabel }}</h3>
            <small class="ref">Commande {{ ref(o.id) }}</small>
            <div class="meta">
              <span>{{ o.type === 'livraison' ? '🚚 Livraison' : '🏪 Retrait' }} : <b>{{ o.date }}</b></span>
              <span>📞 <a [href]="'tel:' + o.tel">{{ o.tel }}</a></span>
              <span>🕒 Reçue {{ o.createdAt ? (o.createdAt | date: 'dd/MM/yyyy HH:mm') : '…' }}</span>
              @if (o.lang === 'ar') { <span>🌐 Arabe</span> }
              @if (o.address) { <span>📍 {{ o.address }}</span> }
            </div>
            @if (o.details) {
              <div class="details" [class.ar]="o.lang === 'ar'" [attr.dir]="o.lang === 'ar' ? 'rtl' : null">{{ o.details }}</div>
            }
          </div>
          <div class="actions">
            <select [value]="o.status" (change)="setStatus(o, $any($event.target).value, $any($event.target))">
              @for (s of statuses; track s) { <option [value]="s" [selected]="s === o.status">{{ s }}</option> }
            </select>
            @if (next(o); as n) {
              <button class="btn small" [class.wa]="n.whatsapp" (click)="n.whatsapp ? notifyClient(o, n.status) : setStatus(o, n.status, $any($event.target).closest('article').querySelector('select'))">{{ n.label }}</button>
            }
            @if (o.invoiceId) { <a class="btn light small" target="_blank" [href]="'/facture/' + o.invoiceId">Voir la facture</a> }
            @if (o.items?.length) { <a class="btn light small" routerLink="/admin/etiquettes" [queryParams]="{ order: o.id }">Étiquettes</a> }
            <a class="btn light small" target="_blank" [href]="'https://wa.me/' + waNumber(o.tel)">Écrire au client</a>
            @if (o.status === 'livré' || o.status === 'récupéré') {
              <a class="btn small review" target="_blank" rel="noopener" [href]="reviewHref(o)">⭐ Demander un avis</a>
            }
            @if (canDelete(auth.role())) { <button class="btn danger small" (click)="remove(o)">Supprimer</button> }
          </div>
        </article>
      } @empty {
        <div class="empty">Aucune commande ici pour le moment.</div>
      }
    </div>
  `,
})
export class Orders implements OnInit {
  protected readonly data = inject(AdminData);
  private readonly shop = inject(Shop);
  protected readonly auth = inject(Auth);
  protected readonly statuses = STATUSES;
  protected readonly filters: Filter[] = ['actives', 'toutes', ...STATUSES];
  protected readonly filter = signal<Filter>('actives');

  protected readonly shown = computed(() => {
    const f = this.filter();
    return this.data.orders().filter(o =>
      f === 'toutes' ? true : f === 'actives' ? !['récupéré', 'livré', 'annulé'].includes(o.status) : o.status === f);
  });

  protected readonly today = computed(() => {
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return this.data.orders().filter(o => o.date === iso && o.status !== 'annulé').length;
  });

  protected readonly ref = orderRef;

  /** Étape suivante de la commande : le client est prévenu sur WhatsApp sauf à la fin */
  protected next(o: Order): { status: OrderStatus; label: string; whatsapp: boolean } | null {
    const delivery = o.type === 'livraison';
    switch (o.status) {
      case 'nouveau': return { status: 'confirmé', label: 'Confirmer sur WhatsApp', whatsapp: true };
      case 'confirmé': return { status: 'prêt', label: 'Prévenir : commande prête', whatsapp: true };
      case 'prêt': return delivery
        ? { status: 'en livraison', label: 'Prévenir : en livraison', whatsapp: true }
        : { status: 'récupéré', label: 'Marquer récupérée', whatsapp: false };
      case 'en livraison': return { status: 'livré', label: 'Marquer livrée', whatsapp: false };
      default: return null;
    }
  }

  ngOnInit() {
    this.shop.load();
  }

  /** Message envoyé au client, dans la langue de sa commande */
  private message(o: Order, status: OrderStatus, invoiceId?: string) {
    const name = this.shop.settings().name_fr, ar = this.shop.settings().name_ar, r = orderRef(o.id);
    const delivery = o.type === 'livraison';
    if (status === 'en livraison') {
      return o.lang === 'ar'
        ? `السلام عليكم ${o.name}، طلبكم رقم ${r} في الطريق إليكم. شكراً لكم!`
        : `Bonjour ${o.name}, votre commande ${r} est en cours de livraison. Merci !`;
    }
    if (status === 'prêt' && delivery) {
      return o.lang === 'ar'
        ? `السلام عليكم ${o.name}، طلبكم رقم ${r} جاهز وسيتم توصيله قريباً. شكراً لكم!`
        : `Bonjour ${o.name}, votre commande ${r} est prête et sera bientôt livrée. Merci !`;
    }
    if (status === 'prêt') {
      return o.lang === 'ar'
        ? `السلام عليكم ${o.name}، طلبكم رقم ${r} جاهز. يمكنكم استلامه من ${ar}. شكراً لكم!`
        : `Bonjour ${o.name}, votre commande ${r} est prête. Vous pouvez la récupérer chez ${name}. Merci !`;
    }
    const link = invoiceId ? `${shopOrigin()}/facture/${invoiceId}` : '';
    const invoice = !link ? '' : o.lang === 'ar' ? `\n\nفاتورتكم وتفاصيل طلبكم: ${link}` : `\n\nVotre facture avec le détail de vos articles : ${link}`;
    const when = o.lang === 'ar'
      ? (delivery ? `تاريخ التوصيل: ${o.date}\nالدفع عند التوصيل.` : `تاريخ الاستلام: ${o.date}\nالدفع في المحل عند الاستلام.`)
      : (delivery ? `Livraison le ${o.date}.\nPaiement à la livraison.` : `Retrait le ${o.date}.\nPaiement en boutique au retrait.`);
    return o.lang === 'ar'
      ? `السلام عليكم ${o.name}، تم تأكيد طلبكم رقم ${r} لدى ${ar}.\n\n${o.details}\n\n${when} شكراً لكم!${invoice}`
      : `Bonjour ${o.name}, votre commande ${r} est confirmée chez ${name}.\n\n${o.details}\n\n${when} Merci !${invoice}`;
  }

  /** Change le statut et ouvre WhatsApp avec le message prêt : il reste à appuyer sur Envoyer. */
  protected async notifyClient(o: Order, status: OrderStatus) {
    // Ouverte tout de suite : le lien de facture n'existe qu'après l'enregistrement, et le navigateur bloquerait la fenêtre
    const win = window.open('', '_blank');
    if (!win) this.data.notify('Autorisez les fenêtres pop-up pour ouvrir WhatsApp.', 6000);
    try {
      const invoiceId = await this.data.changeStatus(o, status);
      const url = `https://wa.me/${this.waNumber(o.tel)}?text=${encodeURIComponent(`${this.message(o, status, invoiceId)}\n\n${o.lang === 'ar' ? 'تتبع طلبكم' : 'Suivre votre commande'} : ${shopOrigin()}/suivi/${o.id}`)}`;
      if (win) win.location.href = url;
      if (status === 'confirmé' && o.items?.some(i => i.special)) this.data.notify(this.confirmedText(o, status), 7000);
      if (invoiceId && location.hostname === 'localhost') {
        this.data.notify('Le lien de facture ne marchera pour le client qu\'une fois le site en ligne.', 8000);
      }
    } catch {
      win?.close();
    }
  }

  protected count(s: OrderStatus) {
    return this.data.orders().filter(o => o.status === s).length;
  }

  /** 0555 12 34 56 → 213555123456 */
  /** Message WhatsApp de remerciement avec le lien pour laisser un avis Google */
  protected reviewHref(o: Order) {
    const s = this.data.settings();
    const link = s.reviewLink || s.mapLink;
    const first = o.name.split(' ')[0];
    const text = o.lang === 'ar'
      ? `السلام عليكم ${first}، شكرا على طلبكم من ${s.name_ar}! إذا أعجبتكم، اتركوا لنا رأيكم على Google، يساعدنا كثيرا 🙏\n${link}`
      : `Bonjour ${first}, merci pour votre commande chez ${s.name_fr} ! Si vous avez été satisfait, laissez-nous un avis sur Google, ça nous aide beaucoup 🙏\n${link}`;
    return `https://wa.me/${this.waNumber(o.tel)}?text=${encodeURIComponent(text)}`;
  }

  protected waNumber(tel: string) {
    const d = tel.replace(/\D/g, '');
    return d.startsWith('0') ? '213' + d.slice(1) : d;
  }

  /** Rappel à la confirmation : le temps de préparation court à partir de maintenant. */
  private confirmedText(o: Order, status: OrderStatus) {
    return status === 'confirmé' && o.items?.some(i => i.special)
      ? `Commande spéciale confirmée : prête à partir de ${specialReadyTime(new Date())}.`
      : 'Statut mis à jour';
  }

  protected async setStatus(o: Order, status: OrderStatus, select: HTMLSelectElement) {
    try {
      await this.data.changeStatus(o, status);
      this.data.notify(this.confirmedText(o, status), 7000);
    } catch {
      // Le message d'erreur est déjà affiché : la liste revient au vrai statut
      select.value = o.status;
    }
  }

  protected readonly canDelete = canDelete;

  protected async remove(o: Order) {
    const consequences = [
      o.stockDone ? 'Son poids revient en stock.' : '',
      o.invoiceId ? 'Sa facture passe en annulée.' : '',
    ].filter(Boolean).join(' ');
    if (!confirm(`Supprimer définitivement la commande de ${o.name} ? ${consequences}`)) return;
    try {
      await this.data.deleteOrder(o);
      this.data.notify('Commande supprimée');
    } catch {
      // Le message d'erreur est déjà affiché
    }
  }
}
