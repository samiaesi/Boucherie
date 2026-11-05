import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { startVisitStats } from './app/core/analytics';

if (!isDevMode()) startVisitStats();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
