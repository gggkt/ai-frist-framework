/**
 * 文件记录实体
 *
 * 对应 SQLite 表 file_records，记录每次上传的文件元数据。
 * 通过 key 与底层存储（local / S3 / OSS / COS）关联。
 *
 * 对应 Java Spring Boot:
 * @Entity
 * @Table(name = "file_records")
 * public class FileRecord { ... }
 */

import { Entity, TableId, TableField } from '@ai-partner-x/aiko-boot-starter-orm';

@Entity({ tableName: 'file_records' })
export class FileRecord {
  @TableId({ type: 'AUTO' })
  id!: number;

  /** 存储 key，全局唯一，格式如 images/abc123-photo.jpg */
  @TableField()
  key!: string;

  /** 原始文件名 */
  @TableField({ column: 'original_name' })
  originalName!: string;

  /** MIME 类型，如 image/jpeg */
  @TableField({ column: 'mime_type' })
  mimeType!: string;

  /** 文件大小（字节） */
  @TableField()
  size!: number;

  /** 公开访问 URL */
  @TableField()
  url!: string;

  /** 上传目录（bucket 内的逻辑分组），如 images / avatars */
  @TableField()
  folder?: string;

  @TableField({ column: 'created_at' })
  createdAt?: string;
}
