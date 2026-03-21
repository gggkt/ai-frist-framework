import 'reflect-metadata';
import express from 'express';
import { createApp } from '@ai-partner-x/aiko-boot';
import { autoInit, getLogger } from '@ai-partner-x/aiko-boot-starter-log';
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

autoInit();
const logger = getLogger('server');

logger.info('Starting API server...');

const projectDir = process.cwd();
const appEnv = process.env.APP_ENV || 'dev';
const envFile = join(projectDir, `.env.${appEnv}`);
if (existsSync(envFile)) {
  loadDotenv({ path: envFile, override: false });
  logger.info(`Loaded env file: ${envFile}`);
} else {
  logger.warn(`Env file not found: ${envFile}`);
}

const srcDir = join(projectDir, 'src'); // Framework scans for controller/service/mapper relative to srcDir
const configPath = projectDir; // configPath should point to the directory with node_modules
const context = await createApp({ srcDir, configPath, verbose: true });

if (!context) {
  logger.warn('ApplicationContext not available');
} else {
  logger.info('Security enabled: ' + context.config.get('security.enabled', true));
}

const expressApp = await import('@ai-partner-x/aiko-boot-starter-web').then((m) => m.getExpressApp());
if (!expressApp) {
  logger.error('Express app not available');
  process.exit(1);
}

expressApp.use(express.json());

const port = context?.config.get('server.port', 3001) ?? 3001;
expressApp.listen(port, () => {
  logger.info('API Server started on port ' + port);
  console.log('📡 API: http://localhost:' + port + '/api');
});

