import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CERTIFICATE_BYTES, Certificate, ENGAGEMENT_KINDS, Engagement, EngagementKind, MAX_CERTIFICATES, MAX_PHOTOS, PHOTO_BYTES, emptyEngagement } from '../core/about';
import { AdminData } from './admin-data';
import { resizeImage } from './image';

@Component({
  selector: 'app-about-admin',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="head">
      <h2>Notre boucherie</h2>
      <a class="btn light small" routerLink="/notre-boucherie" target="_blank">Voir la page</a>
    </div>
    <p class="hint">Le site n'affiche que ce que vous remplissez ici. Un certificat expiré est retiré automatiquement.</p>

    @if (loaded()) {
      <form (ngSubmit)="save()">
        <section class="card-box">
          <h3>Photos du magasin ({{ photos().length }} / {{ maxPhotos }})</h3>
          <div class="gallery">
            @for (p of photos(); track p; let i = $index) {
              <div class="shot">
                <img [src]="p" alt="">
                <button type="button" class="btn danger small" aria-label="Retirer cette photo" (click)="removePhoto(i)">✕</button>
              </div>
            }
          </div>
          @if (photos().length < maxPhotos) {
            <label>Ajouter des photos<input type="file" accept="image/*" multiple (change)="addPhotos($event)"></label>
          }
        </section>

        <section class="card-box">
          <h3>Engagements, environnement et santé</h3>
          @for (e of engagements(); track e; let i = $index) {
            <fieldset>
              <div class="grid2">
                <label>Type
                  <select [name]="'kind' + i" [(ngModel)]="e.kind">
                    @for (k of kinds; track k[0]) { <option [value]="k[0]">{{ k[1].fr }}</option> }
                  </select>
                </label>
                <span class="end"><button type="button" class="btn danger small" aria-label="Retirer" (click)="removeEngagement(i)">✕</button></span>
                <label>Titre (français)<input [name]="'tf' + i" required [(ngModel)]="e.title_fr"></label>
                <label>Titre (arabe)<input [name]="'ta' + i" dir="rtl" required [(ngModel)]="e.title_ar"></label>
                <label>Texte (français)<textarea [name]="'xf' + i" rows="2" [(ngModel)]="e.text_fr"></textarea></label>
                <label>Texte (arabe)<textarea [name]="'xa' + i" dir="rtl" rows="2" [(ngModel)]="e.text_ar"></textarea></label>
              </div>
            </fieldset>
          }
          <div><button type="button" class="btn add-row" (click)="addEngagement()">+ Ajouter un engagement</button></div>
        </section>

        <section class="card-box">
          <h3>Certificats ({{ certificates().length }} / {{ maxCertificates }})</h3>
          <small class="note">Ajoutez uniquement vos vrais documents, délivrés à votre nom.</small>
          @for (c of certificates(); track c.id; let i = $index) {
            <fieldset>
              <div class="grid2">
                <label>Nom (français)<input [name]="'cf' + i" required placeholder="Certificat sanitaire" [(ngModel)]="c.name_fr"></label>
                <label>Nom (arabe)<input [name]="'ca' + i" dir="rtl" required [(ngModel)]="c.name_ar"></label>
                <label>Délivré par<input [name]="'ci' + i" required [(ngModel)]="c.issuer"></label>
                <label>Numéro<input [name]="'cn' + i" [(ngModel)]="c.number"></label>
                <label>Expire le (vide si aucune date)<input [name]="'ce' + i" type="date" [(ngModel)]="c.expires"></label>
                <label>Photo du document<input type="file" accept="image/*" (change)="setDocument(c, $event)"></label>
              </div>
              @if (c.image) { <img class="doc" [src]="c.image" alt=""> }
              <div><button type="button" class="btn danger small" (click)="removeCertificate(i)">Retirer ce certificat</button></div>
            </fieldset>
          }
          @if (certificates().length < maxCertificates) {
            <div><button type="button" class="btn add-row" (click)="addCertificate()">+ Ajouter un certificat</button></div>
          }
        </section>

        @if (error()) { <div class="msg">{{ error() }}</div> }
        <div class="form-actions"><button class="btn" type="submit" [disabled]="saving()">{{ saving() ? 'Enregistrement…' : 'Enregistrer' }}</button></div>
      </form>
    }
  `,
  styles: `
    .hint { margin-bottom: 16px; color: var(--muted); }
    .card-box { max-width: 900px; margin-bottom: 16px; }
    h3 { font-family: Inter, sans-serif; font-size: 1.02rem; }
    .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
    .shot { position: relative; }
    .shot img { display: block; width: 100%; aspect-ratio: 4 / 3; border-radius: 10px; object-fit: cover; }
    .shot button { position: absolute; top: 6px; inset-inline-end: 6px; }
    fieldset { display: grid; gap: 10px; padding: 0 0 14px; border: 0; border-bottom: 1px dashed var(--line); }
    .end { display: flex; align-items: end; justify-content: flex-end; }
    .note { color: var(--muted); }
    .doc { width: 120px; border-radius: 8px; box-shadow: 0 0 0 1px var(--line); }
    .save { margin-bottom: 24px; }
  `,
})
export class AboutAdmin implements OnInit {
  private readonly data = inject(AdminData);
  protected readonly loaded = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly photos = signal<string[]>([]);
  protected readonly engagements = signal<Engagement[]>([]);
  protected readonly certificates = signal<Certificate[]>([]);
  protected readonly kinds = Object.entries(ENGAGEMENT_KINDS) as [EngagementKind, (typeof ENGAGEMENT_KINDS)[EngagementKind]][];
  protected readonly maxPhotos = MAX_PHOTOS;
  protected readonly maxCertificates = MAX_CERTIFICATES;

  async ngOnInit() {
    const about = await this.data.getAbout();
    this.photos.set(about.photos);
    this.engagements.set(about.engagements);
    this.certificates.set(about.certificates);
    this.loaded.set(true);
  }

  protected async addPhotos(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])].slice(0, MAX_PHOTOS - this.photos().length);
    input.value = '';
    this.error.set('');
    try {
      for (const file of files) {
        const photo = await resizeImage(file, 1100, PHOTO_BYTES);
        this.photos.update(list => [...list, photo]);
      }
    } catch (err) {
      this.error.set((err as Error).message);
    }
  }

  protected removePhoto(i: number) {
    this.photos.update(list => list.filter((_, n) => n !== i));
  }

  protected addEngagement() {
    this.engagements.update(list => [...list, emptyEngagement()]);
  }

  protected removeEngagement(i: number) {
    this.engagements.update(list => list.filter((_, n) => n !== i));
  }

  protected addCertificate() {
    this.certificates.update(list => [...list, { id: crypto.randomUUID(), name_fr: '', name_ar: '', issuer: '', number: '', expires: '', image: '' }]);
  }

  protected removeCertificate(i: number) {
    this.certificates.update(list => list.filter((_, n) => n !== i));
  }

  protected async setDocument(c: Certificate, e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    try {
      const image = await resizeImage(file, 1200, CERTIFICATE_BYTES);
      this.certificates.update(list => list.map(x => (x.id === c.id ? { ...x, ...c, image } : x)));
    } catch (err) {
      this.error.set((err as Error).message);
    }
  }

  protected async save() {
    if (this.certificates().some(c => !c.image)) {
      this.error.set('Ajoutez la photo de chaque certificat.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      await this.data.saveAbout(this.photos(), this.engagements(), this.certificates());
      this.data.notify('Page Notre boucherie enregistrée');
    } catch (err) {
      this.error.set((err as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
