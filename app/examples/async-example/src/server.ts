/**
 * @Async Example — API Server
 *
 * 演示 @ai-first/core 的 @Async 装饰器：
 *   - fire-and-forget 后台任务
 *   - 调用方立即收到响应，不等待异步工作完成
 *   - 自定义 onError 错误处理
 *
 * 启动后访问：
 *   http://localhost:3003
 *   http://localhost:3003/api/tasks/log
 */
import { createApp } from '@ai-first/nextjs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3003;

const app = await createApp({
  srcDir: __dirname,
  // 无需数据库 —— 全部使用内存状态演示异步
  verbose: true,
});

app.listen(PORT, () => {
  console.log(`
🚀 @Async Example Server running at http://localhost:${PORT}

📋 Available endpoints:
  POST   /api/tasks/send-email          触发欢迎邮件 (500ms 后台任务)
  POST   /api/tasks/send-password-reset 触发密码重置邮件 (300ms)
  POST   /api/tasks/generate-report     触发销售报告生成 (1000ms)
  POST   /api/tasks/trigger-error       触发必然失败的任务 (演示 onError)
  GET    /api/tasks/log                 查看后台任务执行日志
  DELETE /api/tasks/log                 清空日志

💡 观察方法：
  1. 发送 POST 请求，注意 returnedInMs 字段（几乎为 0）
  2. 等待 1-2 秒后，GET /api/tasks/log 查看后台任务结果
  3. 对比：如果不用 @Async，POST 请求将被阻塞直到任务完成
`);
});
