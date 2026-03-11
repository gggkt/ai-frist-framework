/**
 * 文件管理 Controller — Spring Boot 风格 REST API
 *
 * 负责文件列表查询、删除、URL 获取等操作。
 * 上传接口（POST /api/files/upload）因需要解析原始二进制 body，
 * 使用 express.raw() 在 server.ts 中单独注册，不走此 Controller。
 *
 * 接口列表：
 *   GET    /api/files               → 查询所有文件记录（可按 folder 过滤）
 *   DELETE /api/files/:id           → 删除文件（同时删除存储和 DB 记录）
 *   GET    /api/files/:id/url       → 获取文件公开访问 URL
 *   GET    /api/files/:id/preview   → 获取图片预览 URL（支持 width/height/quality 参数）
 *
 * 对应 Java Spring Boot:
 * @RestController
 * @RequestMapping("/files")
 * public class FileController { ... }
 */

import 'reflect-metadata';
import {
  RestController,
  GetMapping,
  DeleteMapping,
  PathVariable,
  RequestParam,
} from '@ai-partner-x/aiko-boot-starter-web';
import { Autowired } from '@ai-partner-x/aiko-boot';
import { FileRecord } from '../entity/file-record.entity.js';
import { FileService } from '../service/file.service.js';

@RestController({ path: '/files' })
export class FileController {
  @Autowired()
  private fileService!: FileService;

  /**
   * GET /api/files — 查询文件记录列表
   *
   * @param folder 可选查询参数，按上传目录过滤，如 ?folder=images
   */
  @GetMapping()
  async list(@RequestParam('folder') folder?: string): Promise<FileRecord[]> {
    return this.fileService.list(folder);
  }

  /**
   * DELETE /api/files/:id — 删除文件
   *
   * 同时删除底层存储文件和 SQLite 元数据记录。
   */
  @DeleteMapping('/:id')
  async remove(@PathVariable('id') id: string): Promise<{ success: boolean }> {
    await this.fileService.remove(Number(id));
    return { success: true };
  }

  /**
   * GET /api/files/:id/url — 获取文件公开访问 URL
   */
  @GetMapping('/:id/url')
  async getUrl(@PathVariable('id') id: string): Promise<{ url: string }> {
    const url = await this.fileService.getUrl(Number(id));
    return { url };
  }

  /**
   * GET /api/files/:id/preview — 获取图片预览 URL
   *
   * 支持图片处理参数（OSS / COS 时由云端实时处理，本地存储忽略）：
   *   ?width=200&height=200&quality=80&format=webp&fit=cover
   */
  @GetMapping('/:id/preview')
  async getPreviewUrl(
    @PathVariable('id') id: string,
    @RequestParam('width') width?: string,
    @RequestParam('height') height?: string,
    @RequestParam('quality') quality?: string,
    @RequestParam('format') format?: string,
    @RequestParam('fit') fit?: string,
  ): Promise<{ url: string }> {
    const url = await this.fileService.getPreviewUrl(Number(id), {
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
      quality: quality ? Number(quality) : undefined,
      format: format as 'jpg' | 'png' | 'webp' | 'gif' | undefined,
      fit: fit as 'cover' | 'contain' | 'fill' | undefined,
    });
    return { url };
  }
}
