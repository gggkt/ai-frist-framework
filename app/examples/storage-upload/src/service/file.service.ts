/**
 * 文件存储服务
 *
 * 核心业务逻辑层：通过 @Autowired 注入 StorageService 完成实际的文件读写，
 * 同时通过 @Autowired FileRecordMapper 将文件元数据持久化到 SQLite。
 *
 * StorageService 由 StorageAutoConfiguration 在应用启动时自动初始化，
 * 根据 app.config.ts 中的 storage.provider 选择对应的存储适配器
 * （local / s3 / oss / cos）。
 *
 * 对应 Java Spring Boot:
 * @Service
 * public class FileService {
 *   @Autowired StorageService storageService;
 *   @Autowired FileRecordMapper fileRecordMapper;
 * }
 */

import { Service, Autowired } from '@ai-partner-x/aiko-boot';
import { StorageService, type UploadOptions, type ImagePreviewOptions } from '@ai-partner-x/aiko-boot-starter-storage';
import { FileRecord } from '../entity/file-record.entity.js';
import { FileRecordMapper } from '../mapper/file-record.mapper.js';

@Service()
export class FileService {
  /**
   * 底层存储服务，由 StorageAutoConfiguration 自动配置后注入。
   * 适配器在 app.config.ts 的 storage.* 配置中指定（local / s3 / oss / cos）。
   */
  @Autowired()
  private storageService!: StorageService;

  @Autowired()
  private fileRecordMapper!: FileRecordMapper;

  /**
   * 上传文件
   *
   * 1. 调用 StorageService 上传 Buffer 到配置的存储后端
   * 2. 将文件元数据写入 SQLite file_records 表
   * 3. 返回完整的 FileRecord（含 DB 主键 id）
   *
   * @param buffer    文件二进制内容
   * @param fileName  原始文件名（用于推断 MIME 类型和生成存储 key）
   * @param options   上传选项（folder、maxSize、allowedTypes 等）
   */
  async upload(
    buffer: Buffer,
    fileName: string,
    options: UploadOptions = {},
  ): Promise<FileRecord> {
    const result = await this.storageService.upload(buffer, fileName, options);

    const record: Omit<FileRecord, 'id' | 'createdAt'> = {
      key: result.key,
      originalName: result.originalName,
      mimeType: result.mimeType,
      size: result.size,
      url: result.url,
      folder: options.folder,
    };

    await this.fileRecordMapper.insert(record);

    const saved = await this.fileRecordMapper.selectByKey(result.key);
    if (!saved) throw new Error('Failed to save file record');
    return saved;
  }

  /**
   * 查询文件记录列表
   *
   * @param folder 可选，按上传目录过滤
   */
  async list(folder?: string): Promise<FileRecord[]> {
    if (folder) {
      return this.fileRecordMapper.selectByFolder(folder);
    }
    return this.fileRecordMapper.selectList();
  }

  /**
   * 删除文件
   *
   * 同时删除底层存储中的文件和 SQLite 中的元数据记录。
   *
   * @param id FileRecord 的数据库主键
   */
  async remove(id: number): Promise<void> {
    const record = await this.fileRecordMapper.selectById(id);
    if (!record) throw new Error(`文件记录 ${id} 不存在`);

    await this.storageService.delete(record.key);
    await this.fileRecordMapper.deleteById(id);
  }

  /**
   * 获取文件公开访问 URL
   *
   * @param id FileRecord 的数据库主键
   */
  async getUrl(id: number): Promise<string> {
    const record = await this.fileRecordMapper.selectById(id);
    if (!record) throw new Error(`文件记录 ${id} 不存在`);

    return this.storageService.getUrl(record.key);
  }

  /**
   * 获取图片预览 URL
   *
   * OSS / COS 支持服务端图片处理（缩放、格式转换、质量压缩）；
   * 本地存储和 S3 忽略 options，返回原图 URL。
   *
   * @param id      FileRecord 的数据库主键
   * @param options 图片处理选项（width / height / quality / format / fit）
   */
  async getPreviewUrl(id: number, options?: ImagePreviewOptions): Promise<string> {
    const record = await this.fileRecordMapper.selectById(id);
    if (!record) throw new Error(`文件记录 ${id} 不存在`);

    return this.storageService.getPreviewUrl(record.key, options);
  }
}
