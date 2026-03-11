/**
 * 文件记录 Mapper（数据访问层）
 *
 * 继承 BaseMapper<FileRecord>，自动获得标准 CRUD 方法：
 * insert / selectById / selectList / updateById / deleteById
 *
 * 对应 Java Spring Boot (MyBatis-Plus):
 * @Mapper
 * public interface FileRecordMapper extends BaseMapper<FileRecord> { ... }
 */

import 'reflect-metadata';
import { Mapper, BaseMapper } from '@ai-partner-x/aiko-boot-starter-orm';
import { FileRecord } from '../entity/file-record.entity.js';

@Mapper(FileRecord)
export class FileRecordMapper extends BaseMapper<FileRecord> {
  /** 按存储 key 查询单条记录（key 全局唯一） */
  async selectByKey(key: string): Promise<FileRecord | null> {
    const list = await this.selectList({ key } as Partial<FileRecord>);
    return list.length > 0 ? (list[0] ?? null) : null;
  }

  /** 按 folder 查询文件列表 */
  async selectByFolder(folder: string): Promise<FileRecord[]> {
    return this.selectList({ folder } as Partial<FileRecord>);
  }
}
