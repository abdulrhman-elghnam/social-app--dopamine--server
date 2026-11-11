import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { utilService } from './dependency/service/util.service.js';
import { appService } from './app.service.js';

export class AppController {
  public readonly route: RouterType;
  constructor() {
    this.route = Router({
      caseSensitive: true,
      strict: true,
      mergeParams: true,
    });

    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.get(
      '/',
      utilService.responseFormatter({
        handler: async () => {
          return {
            messageCode: 101,
          };
        },
      })
    );

    this.route.use((req, res, next) => {
      try {
        appService.notFoundService();
      } catch (error) {
        next(error);
      }
    });
  }
}

export const appController = new AppController();
