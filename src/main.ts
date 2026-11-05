import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { startVisitStats } from './app/core/analytics';

bootstrapApplication(App, appConfig)
  .then(app => {
    if (!isDevMode()) startVisitStats(app.injector.get(Router));
  })
  .catch((err) => console.error(err));
