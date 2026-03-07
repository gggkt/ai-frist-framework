# @Async Example

演示 `@ai-first/core` 的 **`@Async`** 装饰器 —— Spring Boot 风格的后台任务（fire-and-forget）。

## 快速启动

```bash
# 从仓库根目录安装依赖
pnpm install

# 进入示例目录，启动开发服务器（支持热重载）
cd app/examples/async-example
pnpm dev
```

服务器默认监听 **http://localhost:3003**。

---

## API 接口

### 触发后台任务

#### `POST /api/tasks/send-email`
触发 `@Async sendWelcomeEmail`（模拟 500ms 网络 I/O）。

```bash
curl -X POST http://localhost:3003/api/tasks/send-email \
  -H "Content-Type: application/json" \
  -d '{"to": "alice@example.com", "userId": 42}'
```

响应（立即返回，`returnedInMs` 接近 0）：
```json
{
  "message": "✅ Email task submitted",
  "returnedInMs": 1,
  "note": "Background task started. Email will arrive in ~500ms."
}
```

#### `POST /api/tasks/send-password-reset`
触发 `@Async sendPasswordResetEmail`（模拟 300ms）。

```bash
curl -X POST http://localhost:3003/api/tasks/send-password-reset \
  -H "Content-Type: application/json" \
  -d '{"to": "bob@example.com"}'
```

#### `POST /api/tasks/generate-report`
触发 `@Async generateSalesReport`（模拟 1000ms 重计算）。

```bash
curl -X POST http://localhost:3003/api/tasks/generate-report \
  -H "Content-Type: application/json" \
  -d '{"month": "2024-03"}'
```

#### `POST /api/tasks/trigger-error`
触发必然失败的 `@Async` 任务，演示自定义 `onError` 处理器。
调用方仍然收到 `200 OK`，错误被后台处理器捕获。

```bash
curl -X POST http://localhost:3003/api/tasks/trigger-error \
  -H "Content-Type: application/json" \
  -d '{"reportType": "quarterly"}'
```

### 观察结果

#### `GET /api/tasks/log`
查看所有后台任务的执行结果（1–2 秒后任务完成）：

```bash
curl http://localhost:3003/api/tasks/log
```

响应示例：
```json
{
  "count": 3,
  "tasks": [
    {
      "type": "welcome-email",
      "status": "done",
      "completedAt": "2024-03-07T05:00:00.500Z",
      "durationMs": 502,
      "detail": { "to": "alice@example.com", "userId": 42 }
    },
    {
      "type": "sales-report",
      "status": "done",
      "completedAt": "2024-03-07T05:00:01.010Z",
      "durationMs": 1003,
      "detail": { "month": "2024-03" }
    },
    {
      "type": "failing-report",
      "status": "failed",
      "completedAt": "2024-03-07T05:00:00.210Z",
      "durationMs": 200,
      "detail": { "reportType": "quarterly", "error": "data source unavailable" }
    }
  ]
}
```

#### `DELETE /api/tasks/log`
清空日志，方便重新测试。

```bash
curl -X DELETE http://localhost:3003/api/tasks/log
```

---

## 演示要点

| 特性 | 说明 |
|------|------|
| **立即返回** | `returnedInMs` 几乎为 0，不论后台任务有多耗时 |
| **后台执行** | 任务在 `setImmediate` 调度后、事件循环下一 tick 运行 |
| **错误隔离** | `@Async` 任务抛出的异常不传播给调用方 |
| **自定义 onError** | `@Async({ onError })` 替换默认的 `console.error` |
| **元数据反射** | `isAsync()` / `getAsyncOptions()` 可在运行时检查方法 |

---

## 代码结构

```
src/
├── server.ts                        # createApp 入口 (端口 3003)
├── service/
│   ├── task-log.service.ts          # 内存日志（单例），后台任务写入结果
│   ├── notification.service.ts      # @Async 邮件发送演示
│   └── report.service.ts            # @Async 重计算 + onError 演示
└── controller/
    └── task.controller.ts           # REST 接口，触发异步任务并立即响应
```

## 相关包

- [`@ai-first/core`](../../../packages/core) — 提供 `@Async`、`@Service`、`@Transactional`
- [`@ai-first/nextjs`](../../../packages/nextjs) — 提供 `@RestController`、`createApp`
- [`@ai-first/di`](../../../packages/di) — 提供 `@Autowired` 属性注入
