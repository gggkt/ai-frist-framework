/**
 * TaskLogService - 记录后台任务的执行结果（内存存储）
 *
 * 所有被 @Async 修饰的后台方法在完成或失败后都将写入此日志，
 * 以便通过 GET /api/tasks/log 接口观察异步执行情况。
 */
import 'reflect-metadata';
import { Service } from '@ai-first/core';

export interface TaskLogEntry {
  /** 任务类型 */
  type: string;
  /** 执行状态 */
  status: 'done' | 'failed';
  /** 完成时间 (ISO 8601) */
  completedAt: string;
  /** 耗时（毫秒） */
  durationMs: number;
  /** 附加信息 */
  detail?: Record<string, unknown>;
}

@Service()
export class TaskLogService {
  private readonly logs: TaskLogEntry[] = [];

  addLog(entry: TaskLogEntry): void {
    this.logs.push(entry);
    console.log(`[TaskLog] ${entry.status.toUpperCase()} | ${entry.type} | ${entry.durationMs}ms`);
  }

  getLogs(): TaskLogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs.length = 0;
  }
}
