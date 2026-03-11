import type { AppConfig } from '@ai-partner-x/aiko-boot';

/**
 * Storage-Upload 配置文件（Spring Boot 风格）
 *
 * 演示 @ai-partner-x/aiko-boot-starter-storage 与 REST API 的集成：
 * - createApp 自动加载 app.config.ts、扫描 mapper/ service/ controller/ 并注册到 DI 容器
 * - SQLite 提供文件记录的持久化存储（aiko-boot-starter-orm + Kysely）
 * - 存储：app.config.ts 中 storage.provider = 'local' 触发 StorageAutoConfiguration
 *         对应 @ConditionalOnProperty('storage.provider')
 *
 * 运行前先初始化数据库：
 *   pnpm init-db
 *
 * 启动服务：
 *   pnpm server
 *
 * 切换云存储（以 S3/MinIO 为例）：
 *   storage.provider = 's3'
 *   storage.s3 = { bucket, region, accessKeyId, secretAccessKey, endpoint? }
 *
 * 接口列表：
 *   POST   http://localhost:3003/api/files/upload?fileName=photo.jpg[&folder=images]
 *   GET    http://localhost:3003/api/files
 *   GET    http://localhost:3003/api/files?folder=images
 *   DELETE http://localhost:3003/api/files/:id
 *   GET    http://localhost:3003/api/files/:id/url
 *   GET    http://localhost:3003/api/files/:id/preview[?width=200&height=200&quality=80]
 *   GET    http://localhost:3003/uploads/*  (静态文件访问)
 */

export default {
  // ========== Server Configuration (server.*) ==========
  server: {
    port: Number(process.env.PORT || '3003'),
    servlet: {
      contextPath: '/api',
    },
    shutdown: 'graceful',
  },

  // ========== Database Configuration (database.*) ==========
  database: {
    type: 'sqlite',
    filename: './data/storage_example.db',
  },

  // ========== Storage Configuration (storage.*) ==========
  // storage.provider 触发 StorageAutoConfiguration 的
  // @ConditionalOnProperty('storage.provider') 条件，自动初始化存储适配器。
  //
  // 本地存储（开发/演示）：
  //   uploadDir  = 文件存储路径（相对于工作目录）
  //   baseUrl    = 静态文件访问的 URL 前缀（需与 server.ts 的 express.static 对应）
  storage: {
    provider: 'local',
    local: {
      uploadDir: process.env.UPLOAD_DIR || './uploads',
      baseUrl: process.env.UPLOAD_BASE_URL || 'http://localhost:3003/uploads',
    },
  },
} satisfies AppConfig;
