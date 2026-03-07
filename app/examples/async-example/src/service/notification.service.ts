/**
 * NotificationService - 演示 @Async 的 fire-and-forget 邮件通知
 *
 * 所有发送方法都标注了 @Async，因此调用方会立即拿到 void 返回值，
 * 而实际的"发送"逻辑（在此模拟为 setTimeout 延迟）在后台运行。
 */
import 'reflect-metadata';
import { Service, Async } from '@ai-first/core';
import { Autowired } from '@ai-first/di/server';
import { TaskLogService } from './task-log.service.js';

/** 模拟网络 I/O 延迟 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

@Service()
export class NotificationService {
  @Autowired()
  private taskLogService!: TaskLogService;

  /**
   * 发送注册欢迎邮件（模拟 500 ms 网络延迟）
   *
   * 标注 @Async 后，调用方在触发此方法时立即得到 void 返回，
   * 500 ms 的等待完全在后台发生，不阻塞 HTTP 响应。
   */
  @Async()
  async sendWelcomeEmail(to: string, userId: number): Promise<void> {
    const start = Date.now();
    await sleep(500); // 模拟 SMTP 发送耗时
    this.taskLogService.addLog({
      type: 'welcome-email',
      status: 'done',
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      detail: { to, userId },
    });
    console.log(`[NotificationService] Welcome email sent to ${to} (userId=${userId})`);
  }

  /**
   * 发送密码重置邮件（模拟 300 ms 网络延迟）
   */
  @Async()
  async sendPasswordResetEmail(to: string): Promise<void> {
    const start = Date.now();
    await sleep(300);
    this.taskLogService.addLog({
      type: 'password-reset-email',
      status: 'done',
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      detail: { to },
    });
    console.log(`[NotificationService] Password reset email sent to ${to}`);
  }
}
