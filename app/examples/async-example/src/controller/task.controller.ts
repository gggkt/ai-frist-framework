/**
 * TaskController - @Async 功能演示接口
 *
 * 所有 POST 接口都触发后台异步任务，调用方几乎立刻收到响应。
 * 通过 GET /api/tasks/log 可以观察后台任务何时真正完成。
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  POST /api/tasks/send-email          发送欢迎邮件 (500ms) │
 * │  POST /api/tasks/send-password-reset 密码重置邮件 (300ms) │
 * │  POST /api/tasks/generate-report     销售报告   (1000ms)  │
 * │  POST /api/tasks/trigger-error       必然失败的任务        │
 * │  GET  /api/tasks/log                 查看任务执行日志      │
 * │  DELETE /api/tasks/log               清空日志             │
 * └──────────────────────────────────────────────────────────┘
 */
import 'reflect-metadata';
import {
  RestController,
  GetMapping,
  PostMapping,
  DeleteMapping,
  RequestBody,
} from '@ai-first/nextjs';
import { Autowired } from '@ai-first/di/server';
import { NotificationService } from '../service/notification.service.js';
import { ReportService } from '../service/report.service.js';
import { TaskLogService } from '../service/task-log.service.js';

@RestController({ path: '/tasks' })
export class TaskController {
  @Autowired()
  private notificationService!: NotificationService;

  @Autowired()
  private reportService!: ReportService;

  @Autowired()
  private taskLogService!: TaskLogService;

  /**
   * POST /api/tasks/send-email
   *
   * 触发 @Async sendWelcomeEmail（实际需 500ms）。
   * 响应在 ~0ms 内返回 —— 不等待邮件发送完成。
   */
  @PostMapping('/send-email')
  async sendEmail(
    @RequestBody() body: { to: string; userId: number },
  ): Promise<object> {
    if (!body?.to) throw new Error('Missing required field: to');
    if (body.userId === undefined || body.userId === null) throw new Error('Missing required field: userId');
    const t0 = Date.now();
    this.notificationService.sendWelcomeEmail(body.to, Number(body.userId));
    return {
      message: '✅ Email task submitted',
      returnedInMs: Date.now() - t0,
      note: 'Background task started. Email will arrive in ~500ms.',
    };
  }

  /**
   * POST /api/tasks/send-password-reset
   *
   * 触发 @Async sendPasswordResetEmail（实际需 300ms）。
   */
  @PostMapping('/send-password-reset')
  async sendPasswordReset(
    @RequestBody() body: { to: string },
  ): Promise<object> {
    if (!body?.to) throw new Error('Missing required field: to');
    const t0 = Date.now();
    this.notificationService.sendPasswordResetEmail(body.to);
    return {
      message: '✅ Password reset email task submitted',
      returnedInMs: Date.now() - t0,
      note: 'Background task started. Email will arrive in ~300ms.',
    };
  }

  /**
   * POST /api/tasks/generate-report
   *
   * 触发 @Async generateSalesReport（实际需 1000ms）。
   * 体现 @Async 在计算密集型场景的价值：请求即刻返回。
   */
  @PostMapping('/generate-report')
  async generateReport(
    @RequestBody() body: { month: string },
  ): Promise<object> {
    if (!body?.month) throw new Error('Missing required field: month (e.g. "2024-03")');
    const t0 = Date.now();
    this.reportService.generateSalesReport(body.month);
    return {
      message: '✅ Report generation task submitted',
      returnedInMs: Date.now() - t0,
      note: 'Heavy computation runs in background. Report will be ready in ~1000ms.',
    };
  }

  /**
   * POST /api/tasks/trigger-error
   *
   * 触发必然失败的 @Async 任务。
   * 重点：调用方仍然收到 200 OK，错误由 onError 处理器捕获。
   */
  @PostMapping('/trigger-error')
  async triggerError(
    @RequestBody() body: { reportType: string },
  ): Promise<object> {
    if (!body?.reportType) throw new Error('Missing required field: reportType (e.g. "quarterly")');
    const t0 = Date.now();
    this.reportService.generateFailingReport(body.reportType);
    return {
      message: '✅ Failing task submitted — caller is unaffected by the background error',
      returnedInMs: Date.now() - t0,
      note: 'Check server logs for the onError output. GET /api/tasks/log will show status=failed.',
    };
  }

  /**
   * GET /api/tasks/log
   *
   * 返回所有后台任务的执行记录，可以观察到异步任务的完成情况。
   */
  @GetMapping('/log')
  getLog(): object {
    const logs = this.taskLogService.getLogs();
    return {
      count: logs.length,
      tasks: logs,
    };
  }

  /**
   * DELETE /api/tasks/log
   *
   * 清空任务日志，方便重新测试。
   */
  @DeleteMapping('/log')
  clearLog(): object {
    this.taskLogService.clearLogs();
    return { message: 'Log cleared' };
  }
}
