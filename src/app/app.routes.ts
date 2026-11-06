import { EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import { CanActivateFn, Route, Routes } from '@angular/router';
import { Catalog } from './shop/catalog';
import { Checkout } from './shop/checkout';
import { Home } from './shop/home';
import { ShopLayout } from './shop/layout';
import { ProductPage } from './shop/product-page';
import { TrackPage } from './shop/track-page';

// L'admin (et Firebase Auth) est chargé à la demande : les visiteurs du site ne téléchargent pas son code
const lazyAdminGuard: CanActivateFn = () => {
  const injector = inject(EnvironmentInjector);
  return import('./admin/auth').then(m => runInInjectionContext(injector, m.adminGuard));
};

const lazyPageGuard: CanActivateFn = route => {
  const injector = inject(EnvironmentInjector);
  return import('./admin/auth').then(m => runInInjectionContext(injector, () => m.pageGuard(route)));
};

const page = (path: string, loadComponent: Route['loadComponent']): Route => ({ path, loadComponent, canActivate: [lazyPageGuard] });

export const routes: Routes = [
  {
    path: '',
    component: ShopLayout,
    children: [
      { path: '', pathMatch: 'full', component: Home },
      { path: 'boutique', component: Catalog },
      { path: 'produit/:id', component: ProductPage },
      { path: 'notre-boucherie', loadComponent: () => import('./shop/about-page').then(m => m.AboutPage) },
      { path: 'commande', component: Checkout },
      { path: 'suivi/:id', component: TrackPage },
    ],
  },
  { path: 'facture/:id', loadComponent: () => import('./shop/invoice-page').then(m => m.InvoicePage) },
  { path: 'admin/login', loadComponent: () => import('./admin/login').then(m => m.Login) },
  {
    path: 'admin',
    loadComponent: () => import('./admin/layout').then(m => m.AdminLayout),
    canActivate: [lazyAdminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'commandes' },
      page('tableau', () => import('./admin/dashboard').then(m => m.Dashboard)),
      page('commandes', () => import('./admin/orders').then(m => m.Orders)),
      page('factures', () => import('./admin/invoices').then(m => m.Invoices)),
      page('etiquettes', () => import('./admin/labels').then(m => m.Labels)),
      page('annonces', () => import('./admin/announcements-page').then(m => m.Announcements)),
      page('pro', () => import('./admin/pro').then(m => m.Pro)),
      page('declaration', () => import('./admin/declaration').then(m => m.Declaration)),
      page('equipe', () => import('./admin/team').then(m => m.Team)),
      page('rapport', () => import('./admin/report').then(m => m.Report)),
      page('stock', () => import('./admin/stock').then(m => m.Stock)),
      page('frigo', () => import('./admin/fridge').then(m => m.Fridge)),
      page('rayons', () => import('./admin/categories').then(m => m.Categories)),
      page('produits', () => import('./admin/products').then(m => m.Products)),
      page('formules', () => import('./admin/offers').then(m => m.Offers)),
      page('arrivages', () => import('./admin/arrivals').then(m => m.Arrivals)),
      page('notre-boucherie', () => import('./admin/about-admin').then(m => m.AboutAdmin)),
      page('audit', () => import('./admin/audit-page').then(m => m.Audit)),
      page('horaires', () => import('./admin/hours').then(m => m.Hours)),
      page('parametres', () => import('./admin/settings').then(m => m.Settings)),
    ],
  },
  { path: '**', redirectTo: '' },
];
