# 多环境配置规范（scaffold）

## 目标

在 `scaffold` 内统一前后端环境管理，减少“本地写死地址”和“每个包各自约定”的维护成本。

## 环境模型

- `APP_ENV`: 部署环境标识，仅允许 `dev` / `stage` / `prod`
- `NODE_ENV`: 运行模式，使用 `development` / `production`

约定：

- 开发环境：`APP_ENV=dev` + `NODE_ENV=development`
- 预发环境：`APP_ENV=stage` + `NODE_ENV=production`
- 生产环境：`APP_ENV=prod` + `NODE_ENV=production`

## 文件布局

### Admin

- `packages/admin/.env.dev`
- `packages/admin/.env.stage`
- `packages/admin/.env.prod`

前端变量统一使用 `VITE_` 前缀，例如：

- `VITE_API_URL`
- `VITE_API_PROXY_TARGET`
- `VITE_APP_LOGIN`
- `VITE_APP_USE_GUARD`

### API

- `packages/api/.env.dev`
- `packages/api/.env.stage`
- `packages/api/.env.prod`
- `packages/api/.env.example`

后端启动时按 `APP_ENV` 加载 `packages/api/.env.{APP_ENV}`。

### Mobile

- `packages/mobile/.env.dev`
- `packages/mobile/.env.stage`
- `packages/mobile/.env.prod`
- `packages/mobile/.env.example`

前端变量统一使用 `VITE_` 前缀，例如：

- `VITE_API_URL`（apiBaseUrl，不带 `/api`）
- `VITE_APP_LOGIN`（未授权时 redirect 的登录地址，mobile 路由建议保持 `/login`）

## 启动与构建命令（根目录环境级全量启动）

在 `scaffold` 根目录直接一条命令启动全量项目（`api + admin + mobile`）：

```bash
cd scaffold

# 开发环境
pnpm dev

# 预发环境
pnpm dev:stage

# 生产环境（开发模式下仍跑 Vite Dev Server / Node 服务）
pnpm dev:prod
```

补充：如果你只想启动某一个子项目，可以进入子项目目录运行 `dev:dev/dev:stage/dev:prod`。

## 安全建议

- `.env.dev` 可保留本地默认值
- `.env.stage/.env.prod` 请替换为真实安全值，不要使用示例密钥
- 建议在 CI/CD 或部署平台中覆盖敏感项（如 `JWT_SECRET`）
