import { parseSlots } from '../core/delivery-slots';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DEFAULT_SETTINGS, Settings as ShopSettings } from '../core/data';
import { AdminData } from './admin-data';
import { resizeImage } from './image';

type PhotoKey = 'heroImage' | 'aboutImage';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="head"><h2>Paramètres de la boutique</h2></div>
    @if (loaded()) {
      <form class="card-box" (ngSubmit)="save()">
        <div class="grid2">
          <label>Nom commercial (français)<input name="name_fr" required [(ngModel)]="s.name_fr"></label>
          <label>Nom commercial (arabe)<input name="name_ar" dir="rtl" required [(ngModel)]="s.name_ar"></label>
          <label>Nom de l'entreprise<input name="company" [(ngModel)]="s.company"></label>
          <span></span>
          <label>Adresse (français)<input name="address_fr" [(ngModel)]="s.address_fr"></label>
          <label>Adresse (arabe)<input name="address_ar" dir="rtl" [(ngModel)]="s.address_ar"></label>
          <label>Téléphone affiché<input name="phone" placeholder="05 55 12 34 56" [(ngModel)]="s.phone"></label>
          <label>Numéro WhatsApp (format international)
            <input name="whatsapp" placeholder="213555123456" pattern="[0-9]{8,15}" [(ngModel)]="s.whatsapp">
          </label>
        </div>
        <p class="hours-link">Les horaires se règlent dans <a routerLink="/admin/horaires">Horaires et commandes</a>.</p>
        <div>
          <label>Livraison</label>
          <label class="check" style="margin:8px 0"><input type="checkbox" name="deliveryEnabled" [(ngModel)]="s.deliveryEnabled"> Proposer la livraison aux clients</label>
          @if (s.deliveryEnabled) {
            <div class="grid2">
              <label>Frais de livraison (DA, 0 = toujours gratuite)<input name="deliveryFee" type="number" min="0" step="50" [(ngModel)]="s.deliveryFee"></label>
              <label>Gratuite à partir de (DA, 0 = jamais)<input name="deliveryFreeFrom" type="number" min="0" step="500" [(ngModel)]="s.deliveryFreeFrom"></label>
              <label>Créneaux de livraison (un par ligne, ex. 10:00-12:00)<textarea name="slots" rows="3" [(ngModel)]="slots"></textarea></label>
              <label>Livraisons maximum par créneau (0 = sans limite)<input name="deliverySlotMax" type="number" min="0" [(ngModel)]="s.deliverySlotMax"></label>
              <label style="grid-column:1/-1">Lieux de livraison (un par ligne)<textarea name="zones" rows="3" [(ngModel)]="zones"></textarea></label>
            </div>
          }
        </div>
        <div>
          <label>Carte de fidélité</label>
          <label class="check" style="margin:8px 0"><input type="checkbox" name="loyaltyEnabled" [(ngModel)]="s.loyaltyEnabled"> Activer la carte de fidélité</label>
          @if (s.loyaltyEnabled) {
            <div class="grid2">
              <label>1 point pour combien de DA<input name="loyaltyEvery" type="number" min="1" step="10" [(ngModel)]="s.loyaltyEvery"></label>
              <label>Points pour le cadeau (0 = pas de cadeau)<input name="loyaltyGoal" type="number" min="0" step="10" [(ngModel)]="s.loyaltyGoal"></label>
              <label>Cadeau (français)<input name="loyaltyReward_fr" placeholder="Votre cadeau" [(ngModel)]="s.loyaltyReward_fr"></label>
              <label>Cadeau (arabe)<input name="loyaltyReward_ar" dir="rtl" [(ngModel)]="s.loyaltyReward_ar"></label>
            </div>
          }
        </div>
        <div>
          <label>Informations de facturation</label>
          <div class="grid2" style="margin-top:8px">
            <label>NIF<input name="nif" [(ngModel)]="s.nif"></label>
            <label>NIS<input name="nis" [(ngModel)]="s.nis"></label>
            <label>Registre de commerce (RC)<input name="rc" [(ngModel)]="s.rc"></label>
            <label>Article d'imposition (AI)<input name="ai" [(ngModel)]="s.ai"></label>
            <label>TVA par défaut (%, 0 = aucune)<input name="vatRate" type="number" min="0" max="100" [(ngModel)]="s.vatRate"></label>
            <label>Timbre sur paiement en espèces (%, 0 = aucun)<input name="stampRate" type="number" min="0" max="100" step="0.1" [(ngModel)]="s.stampRate"></label>
          </div>
        </div>
        <div class="grid2">
          @for (p of photos; track p.key) {
            <div>
              <label>{{ p.label }}</label>
              <div class="photo-box">
                @if (images()[p.key]; as url) { <img [src]="url" alt=""> } @else { <span>Aucune photo</span> }
              </div>
              <div class="chips" style="margin-top:8px">
                <label class="btn light small">Choisir une photo
                  <input type="file" accept="image/*" hidden (change)="pickPhoto(p.key, p.size, $event)">
                </label>
                @if (images()[p.key]) { <button type="button" class="btn danger small" (click)="setImage(p.key, undefined)">Retirer</button> }
              </div>
              <small style="color:var(--muted)">{{ p.hint }}</small>
            </div>
          }
        </div>
        @if (error()) { <div class="msg">{{ error() }}</div> }
        <div><button class="btn" type="submit" [disabled]="saving()">{{ saving() ? 'Enregistrement…' : 'Enregistrer' }}</button></div>
      </form>
    }
  `,
  styles: `
    .photo-box { margin-top: 6px; aspect-ratio: 16/9; border: 1px dashed var(--line); border-radius: 10px; background: #f3eee6;
      display: grid; place-items: center; overflow: hidden; color: var(--muted); font-size: .85rem; }
    .photo-box img { width: 100%; height: 100%; object-fit: cover; }
  `,
})
export class Settings implements OnInit {
  private readonly data = inject(AdminData);
  protected readonly loaded = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly images = signal<Partial<Record<PhotoKey, string>>>({});
  protected s: ShopSettings = structuredClone(DEFAULT_SETTINGS);
  protected zones = '';
  protected slots = '';
  protected readonly photos: { key: PhotoKey; label: string; size: number; hint: string }[] = [
    { key: 'heroImage', label: 'Photo de la bannière', size: 1600, hint: "Grande photo en fond d'accueil (format paysage)." },
    { key: 'aboutImage', label: 'Photo « Notre engagement »', size: 900, hint: 'Votre boutique, votre étal ou le boucher au travail.' },
  ];

  async ngOnInit() {
    const { heroImage, aboutImage, ...rest } = await this.data.getSettings();
    this.s = structuredClone(rest);
    this.images.set({ heroImage, aboutImage });
    this.zones = rest.deliveryZones.join('\n');
    this.slots = (rest.deliverySlots ?? []).join('\n');
    this.loaded.set(true);
  }

  protected async pickPhoto(key: PhotoKey, size: number, e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    this.error.set('');
    try {
      this.setImage(key, await resizeImage(file, size, 450_000));
    } catch (err) {
      this.error.set((err as Error).message);
    }
  }

  protected setImage(key: PhotoKey, url: string | undefined) {
    this.images.update(all => ({ ...all, [key]: url }));
  }

  protected async save() {
    const trimmed = Object.fromEntries(
      Object.entries({ ...this.s, ...this.images() })
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]),
    ) as unknown as ShopSettings;
    trimmed.vatRate = Number(this.s.vatRate) || 0;
    trimmed.stampRate = Number(this.s.stampRate) || 0;
    trimmed.deliveryZones = this.zones.split('\n').map(z => z.trim()).filter(Boolean);
    trimmed.deliverySlots = parseSlots(this.slots);
    trimmed.deliverySlotMax = Number(trimmed.deliverySlotMax) || 0;
    trimmed.deliveryFee = Number(this.s.deliveryFee) || 0;
    trimmed.deliveryFreeFrom = Number(this.s.deliveryFreeFrom) || 0;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.data.saveSettings(trimmed);
      this.data.notify('Paramètres enregistrés');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
