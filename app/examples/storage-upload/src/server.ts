/**
 * Storage-Upload API Server — Spring Boot 风格自动配置
 *
 * 演示 @ai-partner-x/aiko-boot-starter-storage 与 REST API 的集成：
 * - createApp 自动加载 app.config.ts、扫描 src/ 中的组件并注册到 DI 容器
 * - StorageAutoConfiguration 根据 storage.provider 自动初始化存储适配器
 * - FileController (@RestController) 提供文件列表/删除/URL 查询接口
 * - 上传接口通过 express.raw() 单独注册（框架 @RequestBody 仅支持 JSON，
 *   二进制 body 需在此处手动添加路由）
 *
 * 运行前先初始化数据库：
 *   pnpm init-db
 *
 * 启动服务：
 *   pnpm server          # 本地存储（默认）
 *   PORT=3003 pnpm server
 *
 * 接口列表：
 *   POST   http://localhost:3003/api/files/upload?fileName=photo.jpg[&folder=images]
 *   GET    http://localhost:3003/api/files[?folder=images]
 *   DELETE http://localhost:3003/api/files/:id
 *   GET    http://localhost:3003/api/files/:id/url
 *   GET    http://localhost:3003/api/files/:id/preview[?width=200&height=200&quality=80]
 *   GET    http://localhost:3003/uploads/*  (静态文件访问，仅本地存储)
 */

import 'reflect-metadata';
import { createApp } from '@ai-partner-x/aiko-boot';
import { getExpressApp } from '@ai-partner-x/aiko-boot-starter-web';
import { Container } from '@ai-partner-x/aiko-boot/di/server';
import express from 'express';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { mkdirSync } from 'fs';
import { FileService } from './service/file.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 确保 uploads 目录存在（本地存储时需要）
const uploadsDir = join(__dirname, '..', 'uploads');
mkdirSync(uploadsDir, { recursive: true });

// createApp 完成时：
//   1. StorageAutoConfiguration 已根据 storage.* 初始化存储适配器
//   2. WebAutoConfiguration 已创建 Express 实例并注册 FileController 路由
//   3. DI 容器中已有 FileService / FileRecordMapper / StorageService 的单例
const app = await createApp({ srcDir: __dirname });

const expressApp = getExpressApp();
if (!expressApp) {
  throw new Error('[storage-upload] Express app not available after createApp()');
}

// ── 本地静态文件访问 ──────────────────────────────────────────────────────────
// 将 ./uploads 目录暴露为 /uploads 路由，与 app.config.ts 中的
// storage.local.baseUrl = 'http://localhost:3003/uploads' 对应。
// 云存储（S3 / OSS / COS）无需此配置，文件直接通过云 CDN 访问。
expressApp.use('/uploads', express.static(uploadsDir));

// ── 文件上传接口 ──────────────────────────────────────────────────────────────
// POST /api/files/upload
//
// 框架的 @RestController 路由只支持 express.json()，不支持原始二进制 body。
// 因此在此处手动注册上传路由，使用 express.raw() 解析任意 Content-Type 的原始 body。
//
// 请求示例（curl）：
//   curl -X POST "http://localhost:3003/api/files/upload?fileName=photo.jpg&folder=images" \
//        -H "Content-Type: image/jpeg" \
//        --data-binary @/path/to/photo.jpg
const fileService = Container.resolve(FileService);

expressApp.post(
  '/api/files/upload',
  express.raw({ type: '*/*', limit: '50mb' }),
  async (req: express.Request, res: express.Response) => {
    const start = Date.now();
    try {
      const fileName = req.query['fileName'] as string;
      const folder = req.query['folder'] as string | undefined;

      if (!fileName) {
        res.status(400).json({ success: false, error: 'fileName 查询参数不能为空' });
        return;
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ success: false, error: '请求体必须是非空的二进制文件内容' });
        return;
      }

      const record = await fileService.upload(req.body, fileName, { folder });

      console.log(
        `[aiko-boot] POST    /api/files/upload 200 (${Date.now() - start}ms) key=${record.key}`,
      );
      res.json({ success: true, data: record });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[aiko-boot] POST    /api/files/upload 400 (${Date.now() - start}ms) ${message}`);
      res.status(400).json({ success: false, error: message });
    }
  },
);

app.run();
