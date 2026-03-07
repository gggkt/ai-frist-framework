/**
 * ReportService - 演示 @Async 的重计算任务 + 自定义 onError 错误处理
 *
 * generateSalesReport  —— 1 秒的"重"计算，fire-and-forget
 * generateFailingReport —— 必然抛错，展示 @Async({ onError }) 捕获机制
 */
import 'reflect-metadata';
import { Service, Async } from '@ai-first/core';
import { Autowired } from '@ai-first/di/server';
import { TaskLogService } from './task-log.service.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

@Service()
export class ReportService {
  @Autowired()
  private taskLogService!: TaskLogService;

  /**
   * 生成销售报告（模拟 1 秒重计算）
   *
   * 因为标注了 @Async，HTTP 响应在 ~0 ms 内返回，
   * 1 秒后报告完成并写入日志。
   */
  @Async()
  async generateSalesReport(month: string): Promise<void> {
    const start = Date.now();
    await sleep(1000); // 模拟大量数据聚合
    this.taskLogService.addLog({
      type: 'sales-report',
      status: 'done',
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      detail: { month },
    });
    console.log(`[ReportService] Sales report for ${month} generated`);
  }

  /**
   * 必然失败的任务 —— 演示 @Async({ onError }) 的错误隔离
   *
   * 关键点：即使后台任务抛出异常，调用方（HTTP 响应）依然是 200 OK。
   * 错误由自定义 onError 处理器捕获，不会传播给调用方。
   */
  @Async({
    onError: (err, method) => {
      console.error(`[ReportService] Custom onError caught in "${method}":`, (err as Error).message);
    },
  })
  async generateFailingReport(reportType: string): Promise<void> {
    await sleep(200);
    this.taskLogService.addLog({
      type: 'failing-report',
      status: 'failed',
      completedAt: new Date().toISOString(),
      durationMs: 200,
      detail: { reportType, error: 'data source unavailable' },
    });
    throw new Error(`Report generation failed for "${reportType}": data source unavailable`);
  }
}
