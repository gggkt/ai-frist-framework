import path from 'path';
import fs from 'fs-extra';
import type { Logger } from '../core/logger.js';
import { loadProjectConfig } from '../core/project-config.js';

type EnvTarget =
  | {
      kind: 'api';
      name: string;
      relDir: string;
    }
  | {
      kind: 'app';
      type: 'admin' | 'mobile' | string;
      name: string;
      relDir: string;
    };

function modeToNodeEnv(mode: string): 'development' | 'production' {
  return mode === 'dev' ? 'development' : 'production';
}

function setOrReplaceKey(text: string, key: string, value: string): string {
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) return text.replace(re, `${key}=${value}`);
  const prefix = text.endsWith('\n') ? '' : '\n';
  return `${text}${prefix}${key}=${value}\n`;
}

function patchFrontendEnv(text: string, mode: string): string {
  let patched = setOrReplaceKey(text, 'APP_ENV', mode);
  // Vite 不支持通过前端 .env 覆盖 NODE_ENV；移除避免警告/行为不一致
  patched = patched.replace(/^NODE_ENV=.*$/m, '');
  return patched;
}

function patchApiEnv(text: string, mode: string): string {
  const nodeEnv = modeToNodeEnv(mode);
  let patched = setOrReplaceKey(text, 'APP_ENV', mode);
  patched = setOrReplaceKey(patched, 'NODE_ENV', nodeEnv);
  return patched;
}

function buildPnpmRootDevScript(args: {
  pkgs: string[];
  mode: string;
}): string {
  const filters = args.pkgs.map((p) => `--filter "${p}"`).join(' ');
  return `pnpm -r --parallel ${filters} dev:${args.mode}`;
}

function buildApiDevScript(mode: string): string {
  return `cross-env APP_ENV=${mode} NODE_ENV=${modeToNodeEnv(
    mode,
  )} concurrently -n codegen,server -c blue,green "pnpm codegen:watch" "node --import @swc-node/register/esm-register --watch src/server.ts"`;
}

function buildApiStartScript(mode: string): string {
  return `cross-env APP_ENV=${mode} NODE_ENV=${modeToNodeEnv(
    mode,
  )} node dist/server.js`;
}

function buildAdminDevScript(mode: string): string {
  return `vite --mode ${mode}`;
}

function buildAdminBuildScript(mode: string): string {
  return `tsc && vite build --mode ${mode}`;
}

function buildMobileDevScript(mode: string): string {
  return `vite --mode ${mode} --port 3002`;
}

function buildMobileBuildScript(mode: string): string {
  return `tsc --noEmit && vite build --mode ${mode}`;
}

export type EnvUseCaseDeps = {
  logger: Logger;
};

export function createEnvUseCase(deps: EnvUseCaseDeps) {
  const { logger } = deps;

  function extractModesFromDirFiles(files: string[]): string[] {
    const modes: string[] = [];
    for (const file of files) {
      const m = file.match(/^\.env\.(.+)$/);
      if (!m) continue;
      const suffix = m[1];
      // .env.example 不符合这个正则，但我们也防御一下
      if (!suffix || suffix === 'example') continue;
      modes.push(suffix);
    }
    return modes;
  }

  async function getTargets(rootDir: string): Promise<{
    config: any;
    scope: string;
    targets: EnvTarget[];
  }> {
    const config = await loadProjectConfig(rootDir);
    if (!config) {
      throw new Error(
        '未找到 .aiko-boot.json，当前目录似乎不是脚手架根目录，请在 create 生成的根目录下执行。',
      );
    }
    const scope = config.scope ?? 'scaffold';
    const targets: EnvTarget[] = [];

    for (const api of config.apis ?? []) {
      targets.push({ kind: 'api', name: api.name, relDir: api.path });
    }
    for (const app of config.apps ?? []) {
      targets.push({
        kind: 'app',
        type: app.type,
        name: app.name,
        relDir: app.path,
      });
    }

    return { config, scope, targets };
  }

  async function list(args: { rootDir: string }): Promise<string[]> {
    const { scope, targets } = await getTargets(args.rootDir);
    void scope;

    const modes = new Set<string>();
    const existence: Record<string, Record<string, boolean>> = {};
    const targetKeys = targets.map((t) => `${t.kind}:${t.name}`);

    for (const target of targets) {
      const dir = path.join(args.rootDir, target.relDir);
      const files = (await fs.pathExists(dir)) ? await fs.readdir(dir) : [];
      const envModes = extractModesFromDirFiles(files);
      for (const m of envModes) modes.add(m);
    }

    const sorted = Array.from(modes).sort();
    for (const m of sorted) {
      existence[m] = {};
      for (const key of targetKeys) existence[m][key] = false;
      for (const target of targets) {
        const dir = path.join(args.rootDir, target.relDir);
        const file = path.join(dir, `.env.${m}`);
        const key = `${target.kind}:${target.name}`;
        if (await fs.pathExists(file)) existence[m][key] = true;
      }
    }

    logger.info('Available environments:');
    for (const m of sorted) {
      const parts = targets.map((t) => {
        const key = `${t.kind}:${t.name}`;
        return `${key}=${existence[m][key] ? 'yes' : 'no'}`;
      });
      logger.info(`- ${m}: ${parts.join(', ')}`);
    }

    if (sorted.length === 0) {
      logger.info('- (none found)');
    }

    return sorted;
  }

  async function add(args: {
    rootDir: string;
    mode: string;
    dryRun: boolean;
    force: boolean;
    injectScripts?: boolean;
    onExisting?: 'error' | 'skip';
  }): Promise<void> {
    const { scope, targets } = await getTargets(args.rootDir);
    const mode = args.mode;
    const injectScripts = args.injectScripts ?? true;
    const onExisting = args.onExisting ?? 'error';

    const rootPkgPath = path.join(args.rootDir, 'package.json');
    if (!(await fs.pathExists(rootPkgPath))) {
      throw new Error(`未找到根 package.json：${rootPkgPath}`);
    }
    const rootPkg = await fs.readJson(rootPkgPath);
    rootPkg.scripts = rootPkg.scripts ?? {};

    const pkgsToRun: string[] = [];
    for (const target of targets) {
      const packageName = `@${scope}/${target.name}`;
      if (target.kind === 'api') pkgsToRun.push(packageName);
      if (target.kind === 'app' && (target.type === 'admin' || target.type === 'mobile')) {
        pkgsToRun.push(packageName);
      }
    }

    // 1) env 文件生成
    for (const target of targets) {
      const dir = path.join(args.rootDir, target.relDir);
      const templatePath = path.join(dir, '.env.example');
      const outPath = path.join(dir, `.env.${mode}`);

      if ((await fs.pathExists(outPath)) && !args.force) {
        if (onExisting === 'skip') {
          logger.info(
            `ℹ️ Skip existing env for ${target.kind}:${target.name} (${mode})`,
          );
          continue;
        }
        throw new Error(`目标 env 已存在：${outPath}（可用 --force 覆盖）`);
      }
      if (args.dryRun) {
        logger.info(`[dry-run] Generate: ${path.relative(args.rootDir, outPath)}`);
        continue;
      }

      if (!(await fs.pathExists(templatePath))) {
        throw new Error(
          `缺少 .env.example：${templatePath}（请先在该应用/服务目录补齐环境模板文件）`,
        );
      }

      let text = await fs.readFile(templatePath, 'utf8');
      text = target.kind === 'api' ? patchApiEnv(text, mode) : patchFrontendEnv(text, mode);
      await fs.writeFile(outPath, text, 'utf8');
      logger.info(`✅ Generated: ${path.relative(args.rootDir, outPath)}`);
    }

    // 2) 脚本注入：根目录 dev:<mode>（不包含 dev 这个模式）
    if (injectScripts) {
      if (mode !== 'dev' && pkgsToRun.length > 0) {
        rootPkg.scripts[`dev:${mode}`] = buildPnpmRootDevScript({
          pkgs: pkgsToRun,
          mode,
        });
      }

      if (!args.dryRun) {
        await fs.writeJson(rootPkgPath, rootPkg, { spaces: 2 });
      }

      // 3) 脚本注入：各包 dev:<mode> / build:<mode> / start:<mode>
      for (const target of targets) {
        if (target.kind === 'api') {
          const pkgPath = path.join(args.rootDir, target.relDir, 'package.json');
          if (!(await fs.pathExists(pkgPath))) continue;

          const pkg = await fs.readJson(pkgPath);
          pkg.scripts = pkg.scripts ?? {};
          pkg.scripts[`dev:${mode}`] = buildApiDevScript(mode);
          pkg.scripts[`start:${mode}`] = buildApiStartScript(mode);

          if (!args.dryRun) {
            await fs.writeJson(pkgPath, pkg, { spaces: 2 });
          }
        } else if (target.type === 'admin') {
          const pkgPath = path.join(args.rootDir, target.relDir, 'package.json');
          if (!(await fs.pathExists(pkgPath))) continue;

          const pkg = await fs.readJson(pkgPath);
          pkg.scripts = pkg.scripts ?? {};
          pkg.scripts[`dev:${mode}`] = buildAdminDevScript(mode);
          pkg.scripts[`build:${mode}`] = buildAdminBuildScript(mode);

          if (!args.dryRun) {
            await fs.writeJson(pkgPath, pkg, { spaces: 2 });
          }
        } else if (target.type === 'mobile') {
          const pkgPath = path.join(args.rootDir, target.relDir, 'package.json');
          if (!(await fs.pathExists(pkgPath))) continue;

          const pkg = await fs.readJson(pkgPath);
          pkg.scripts = pkg.scripts ?? {};
          pkg.scripts[`dev:${mode}`] = buildMobileDevScript(mode);
          pkg.scripts[`build:${mode}`] = buildMobileBuildScript(mode);

          if (!args.dryRun) {
            await fs.writeJson(pkgPath, pkg, { spaces: 2 });
          }
        } else {
          logger.warn(
            `跳过未知应用类型（无法自动注入脚本）：${target.kind}:${target.name} type=${target.type}`,
          );
        }
      }
    }
  }

  async function remove(args: {
    rootDir: string;
    mode: string;
    dryRun: boolean;
    force: boolean;
  }): Promise<void> {
    const { scope, targets } = await getTargets(args.rootDir);
    const mode = args.mode;

    const rootPkgPath = path.join(args.rootDir, 'package.json');
    if (!(await fs.pathExists(rootPkgPath))) {
      throw new Error(`未找到根 package.json：${rootPkgPath}`);
    }
    const rootPkg = await fs.readJson(rootPkgPath);
    rootPkg.scripts = rootPkg.scripts ?? {};

    if (mode !== 'dev' && rootPkg.scripts[`dev:${mode}`]) {
      delete rootPkg.scripts[`dev:${mode}`];
    }
    if (!args.dryRun) {
      await fs.writeJson(rootPkgPath, rootPkg, { spaces: 2 });
    }

    for (const target of targets) {
      const dir = path.join(args.rootDir, target.relDir);
      const envPath = path.join(dir, `.env.${mode}`);

      if (!(await fs.pathExists(envPath))) {
        if (!args.force) {
          throw new Error(`目标 env 不存在：${path.relative(args.rootDir, envPath)}`);
        }
      } else if (args.dryRun) {
        logger.info(`[dry-run] Remove: ${path.relative(args.rootDir, envPath)}`);
      } else {
        await fs.remove(envPath);
        logger.info(`🗑️ Removed: ${path.relative(args.rootDir, envPath)}`);
      }

      const pkgPath = path.join(dir, 'package.json');
      if (!(await fs.pathExists(pkgPath))) continue;
      const pkg = await fs.readJson(pkgPath);
      pkg.scripts = pkg.scripts ?? {};

      if (target.kind === 'api') {
        // api 的默认 dev 通常依赖 dev:dev（如 dev: "pnpm dev:dev"）
        // 因此 mode=dev 时不要删除 dev:dev/start:dev 脚本，避免破坏 pnpm dev。
        if (mode !== 'dev') {
          delete pkg.scripts[`dev:${mode}`];
          delete pkg.scripts[`start:${mode}`];
        }
      } else if (target.type === 'admin') {
        delete pkg.scripts[`dev:${mode}`];
        delete pkg.scripts[`build:${mode}`];
      } else if (target.type === 'mobile') {
        delete pkg.scripts[`dev:${mode}`];
        delete pkg.scripts[`build:${mode}`];
      }

      if (!args.dryRun) {
        await fs.writeJson(pkgPath, pkg, { spaces: 2 });
      }
    }

    void scope;
  }

  return {
    list,
    add,
    remove,
  };
}

