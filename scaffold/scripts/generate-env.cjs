/* eslint-disable no-console */
/**
 * Generate scaffold env files for admin/api/mobile.
 *
 * Usage:
 *   node ./scripts/generate-env.cjs --env qa --app all
 *
 * It copies each app's `.env.example` to `.env.<env>` (and updates APP_ENV and
 * NODE_ENV for api).
 *
 * NOTE:
 * - This command generates templates/placeholders. You still need to edit
 *   URLs and secrets in the generated files.
 */
const fs = require('fs');
const path = require('path');

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const env = getArg('--env');
const app = getArg('--app') || 'all';
const force = hasFlag('--force');

if (!env) {
  console.error('Missing required arg: --env <mode>');
  console.error('Example: node ./scripts/generate-env.cjs --env qa --app all');
  process.exit(1);
}

const appMap = {
  admin: 'packages/admin',
  api: 'packages/api',
  mobile: 'packages/mobile',
};

const selectedApps =
  app === 'all'
    ? Object.keys(appMap)
    : app
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

const scaffoldRoot = path.resolve(__dirname, '..');

function setOrReplaceKey(text, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) return text.replace(re, `${key}=${value}`);
  // If key doesn't exist, append at end with a newline.
  const prefix = text.endsWith('\n') ? '' : '\n';
  return `${text}${prefix}${key}=${value}\n`;
}

function copyAndPatch(templatePath, outPath, { patchAppEnv = true, patchNodeEnv = false, nodeEnvValue }) {
  if (fs.existsSync(outPath) && !force) {
    throw new Error(`Env file already exists: ${outPath} (use --force to overwrite)`);
  }

  fs.copyFileSync(templatePath, outPath);

  let text = fs.readFileSync(outPath, 'utf8');

  if (patchAppEnv) {
    text = setOrReplaceKey(text, 'APP_ENV', env);
  }

  if (patchNodeEnv) {
    text = setOrReplaceKey(text, 'NODE_ENV', nodeEnvValue);
  }

  fs.writeFileSync(outPath, text, 'utf8');
}

for (const appName of selectedApps) {
  const appRelPath = appMap[appName];
  if (!appRelPath) {
    console.error(`Unknown app: ${appName}. Supported: admin, api, mobile`);
    process.exit(1);
  }

  const appDir = path.join(scaffoldRoot, appRelPath);
  const templatePath = path.join(appDir, '.env.example');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Missing template: ${templatePath}`);
  }

  const outPath = path.join(appDir, `.env.${env}`);

  if (appName === 'api') {
    // By convention:
    // - dev => development
    // - stage/prod/others => production
    const nodeEnvValue = env === 'dev' ? 'development' : 'production';
    copyAndPatch(templatePath, outPath, { patchAppEnv: true, patchNodeEnv: true, nodeEnvValue });
  } else {
    // Frontend env files should not set NODE_ENV for Vite.
    copyAndPatch(templatePath, outPath, { patchAppEnv: true, patchNodeEnv: false });
  }

  console.log(`✅ Generated: ${path.relative(scaffoldRoot, outPath)}`);
}

