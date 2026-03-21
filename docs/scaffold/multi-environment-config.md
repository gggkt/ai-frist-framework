# Scaffold 多环境配置（dev / stage / prod）

本页面向 `scaffold/` 这个前后端一体 monorepo，说明如何做多环境配置、如何启动，并给出“新增环境”的推荐流程。

## 1. 概念：环境 vs 模式

- `APP_ENV`: 部署环境标识（推荐仅使用：`dev` / `stage` / `prod`）
- `NODE_ENV`: 运行模式（后端使用 `development` / `production`）
- Vite `mode`: 前端使用 `vite --mode <mode>`，会自动加载对应的 `.env.<mode>`（例如 `--mode stage` 会读取 `.env.stage`）

约定：

- 开发：`APP_ENV=dev` + 前端 `--mode dev` + 后端 `NODE_ENV=development`
- 预发：`APP_ENV=stage` + 前端 `--mode stage` + 后端 `NODE_ENV=production`
- 生产：`APP_ENV=prod` + 前端 `--mode prod` + 后端 `NODE_ENV=production`

## 2. 目录与文件布局

## Admin（前端）

- `scaffold/packages/admin/.env.dev`
- `scaffold/packages/admin/.env.stage`
- `scaffold/packages/admin/.env.prod`
- `scaffold/packages/admin/.env.example`（生成模板用）

Vite env 变量使用 `VITE_` 前缀，`admin` 主要依赖：

- `VITE_APP_LOGIN`: 未授权时 redirect 到的登录地址（建议保持为 `/login`，也可改为完整 URL）
- `VITE_API_URL`: 后端 API Base URL（不包含 `/api`）
- `VITE_API_PROXY_TARGET`: Vite dev server 代理 `/api` 的目标地址（仅在 dev server 场景有效）
- `VITE_APP_USE_GUARD`: 前端守卫开关

## Mobile（前端）

- `scaffold/packages/mobile/.env.dev`
- `scaffold/packages/mobile/.env.stage`
- `scaffold/packages/mobile/.env.prod`
- `scaffold/packages/mobile/.env.example`（生成模板用）

Vite env 变量使用 `VITE_` 前缀，`mobile` 主要依赖：

- `VITE_API_URL`: 后端 API Base URL（不包含 `/api`）
- `VITE_APP_LOGIN`: 未授权时 redirect 的登录地址（建议保持为 `/login`）

## API（后端）

- `scaffold/packages/api/.env.dev`
- `scaffold/packages/api/.env.stage`
- `scaffold/packages/api/.env.prod`
- `scaffold/packages/api/.env.example`（生成模板用）

后端启动时会读取：`.env.${APP_ENV}`，因此需要保证启动命令能正确传入 `APP_ENV`。

后端常用变量（按模块）：

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `SESSION_SECRET`
- `CORS_ORIGIN`
- `REDIS_HOST`（启用缓存时）
- `REDIS_PORT`（启用缓存时）

## 3. 启动与构建命令（根目录环境级全量启动）

先初始化数据库（仅需要一次）：

```bash
cd scaffold
pnpm init-db
```

### 3.1 开发环境（dev）

```bash
pnpm dev
```

### 3.2 预发环境（stage）

```bash
pnpm dev:stage
```

### 3.3 生产环境（prod）

```bash
pnpm dev:prod
```

补充：只启动某一个子项目（需要你切到子项目目录）：

- `packages/api`：`pnpm dev:dev / dev:stage / dev:prod`
- `packages/admin`：`pnpm dev:dev / dev:stage / dev:prod`
- `packages/mobile`：`pnpm dev:dev / dev:stage / dev:prod`

## 4. 关键注意事项

1. `VITE_API_URL` 不要包含 `/api`
   - `createBackendAuthProvider` 会在内部拼接 `/api/auth/...`
2. 前端 `.env.*` 不要写 `NODE_ENV`
   - Vite 不支持通过前端 `.env` 去覆盖 `NODE_ENV`（会导致警告/行为不一致）
3. stage/prod 的 `CORS_ORIGIN` 需要把所有前端域名都放进去
   - 否则浏览器会直接拦截请求

## 5. 新增一套环境（例如 qa）怎么做？

推荐分两步：先生成 env 文件，再把真实值补齐。

### 5.1 通过命令生成 env 文件（推荐）

你可以用 scaffold 提供的命令生成模板文件：

```bash
cd scaffold
pnpm env:generate -- --env qa --app all
```

它会：

- 从各应用的 `.env.example` 复制生成：
  - `packages/admin/.env.qa`
  - `packages/api/.env.qa`
  - `packages/mobile/.env.qa`
- 自动更新 `APP_ENV=qa`
- 对 `api` 额外自动设置 `NODE_ENV`（`dev => development`，其他 => production）

生成后，你仍需要手动编辑这些文件中的真实值，例如：

- `VITE_API_URL`
- `VITE_APP_LOGIN`
- `VITE_API_PROXY_TARGET`（admin）
- `JWT_SECRET`、`SESSION_SECRET`
- `CORS_ORIGIN`
- `REDIS_*`（若启用缓存）

### 5.2 运行脚本：需要手动补齐（当前策略）

目前项目为了方便，已经写死了 `dev:*/stage:*/prod:*` 三套脚本。

因此新增 `qa` 环境要做到“和 dev/stage/prod 一样的一键命令”，你需要在以下位置按同样方式补脚本（推荐复制 `dev:dev` / `dev:stage` / `dev:prod` 的模式）：

- `scaffold/packages/admin/package.json`
- `scaffold/packages/mobile/package.json`
- `scaffold/packages/api/package.json`

如果你更希望“任意环境值都能一键运行”，可以在后续把脚本改造成可参数化（例如 `run --env <mode>`），再写进同一套规范；这部分属于增强建议。

