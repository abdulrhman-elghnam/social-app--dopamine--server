import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import swaggerUi from 'swagger-ui-express';
import { configService } from './dependency/service/config.service.js';

const DOCS_DIR = resolve('public/documentation');
const SWAGGER_FILE = resolve(DOCS_DIR, 'swagger.json');
const POSTMAN_FILE = resolve(DOCS_DIR, 'postman.json');

export const docsEnabled = configService.get('DOCS_ENABLED', 'true')?.trim().toLowerCase() !== 'false';

function loadSpec(): Record<string, unknown> | null {
  if (!existsSync(SWAGGER_FILE)) return null;
  const spec = JSON.parse(readFileSync(SWAGGER_FILE, 'utf8')) as Record<string, unknown>;
  return Object.keys(spec).length ? spec : null;
}

export function documentationRouter(): RouterType {
  const router = Router();
  const spec = loadSpec();

  router.get('/swagger.json', (_req, res) => {
    res.sendFile(SWAGGER_FILE);
  });
  router.get('/postman.json', (_req, res) => {
    res.download(POSTMAN_FILE, 'dopamine.postman_collection.json');
  });

  if (spec) {
    router.use(swaggerUi.serve);
    router.get(
      '/',
      swaggerUi.setup(spec, {
        customSiteTitle: 'Dopamine API Docs',
        customCss: '.swagger-ui .topbar { display: none }',
        swaggerOptions: { persistAuthorization: true, docExpansion: 'none', displayRequestDuration: true },
      }),
    );
  }

  return router;
}
