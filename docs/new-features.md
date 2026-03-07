# AI-First Framework — 新特性功能 Summary

> 本文档覆盖三项新增能力：**文件上传**（`MultipartFile` + `@RequestPart`）、**请求绑定参数装饰器**（`@ModelAttribute` + `@RequestAttribute`）和**异步与响应式支持**（`@Async`）。
>
> 完整示例代码见 [`app/examples/api-new-feature/`](../app/examples/api-new-feature/)。

---

## 一、文件上传 — `MultipartFile` + `@RequestPart`

### 功能概述

提供与 Spring Boot `@RequestPart` + `org.springframework.web.multipart.MultipartFile` 完全对齐的文件上传 API：

- 在 `@RestController` 方法的参数上标注 `@RequestPart(fieldName)`，框架**自动注入** multer `memoryStorage` 中间件，无需手动配置。
- 框架将 multer 原始文件对象包装为 `MultipartFile` 接口，暴露与 Java 完全一致的方法签名。
- 支持单文件、指定自定义字段名、以及同一方法内多文件字段并存。

| TypeScript | Java Spring 对应 |
|---|---|
| `@RequestPart(name?)` | `@RequestPart` |
| `MultipartFile` 接口 | `org.springframework.web.multipart.MultipartFile` |

### 开发思路

1. **元数据驱动**：`@RequestPart` 通过 `reflect-metadata` 在方法的参数维度写入字段名；路由注册阶段读取元数据，若存在则自动挂载 multer 中间件。
2. **零配置**：开发者无需在 Express 层手动 `app.use(multer(...))` 或在路由上添加中间件，只需在参数上加装饰器。
3. **Spring 接口对齐**：包装对象严格对标 `MultipartFile` 接口，使 AI 能基于 Spring Boot 知识生成代码，同时支持未来的 TypeScript → Java 转译。

### 技术实现

#### `MultipartFile` 接口（`@ai-first/nextjs`）

```typescript
export interface MultipartFile {
  /** 返回表单字段名（multipart part name） */
  getName(): string;
  /** 返回客户端文件系统中的原始文件名 */
  getOriginalFilename(): string;
  /** 返回文件 Content-Type，未设置时返回 null */
  getContentType(): string | null;
  /** 返回文件字节数 */
  getSize(): number;
  /** 以 Buffer 返回文件内容 */
  getBytes(): Buffer;
  /** 文件是否为空（size === 0） */
  isEmpty(): boolean;
  /** 将文件写入目标路径 */
  transferTo(dest: string): Promise<void>;
}
```

#### `@RequestPart` 参数装饰器（`@ai-first/nextjs`）

```typescript
export function RequestPart(name?: string) {
  return function (target: any, propertyKey: string, parameterIndex: number) {
    const requestParts = Reflect.getMetadata(REQUEST_PART_METADATA, target, propertyKey) || {};
    requestParts[parameterIndex] = { name: name || 'file' };
    Reflect.defineMetadata(REQUEST_PART_METADATA, requestParts, target, propertyKey);
  };
}
```

#### 路由注册时的自动中间件注入（`packages/nextjs/src/express-router.ts`）

```typescript
// 若方法存在 @RequestPart 参数，则自动挂载 multer memoryStorage
const uploadMiddleware = Object.keys(partParams).length > 0
  ? multer({ storage: multer.memoryStorage() }).fields(
      Object.values(partParams).map(p => ({ name: p.name, maxCount: 1 }))
    )
  : null;

if (uploadMiddleware) {
  router[httpMethod](fullPath, uploadMiddleware, handler);
} else {
  router[httpMethod](fullPath, handler);
}
```

### 快速开始

```typescript
import { RestController, PostMapping, RequestPart, type MultipartFile } from '@ai-first/nextjs';

@RestController({ path: '/upload' })
export class UploadController {
  /** 单文件上传 */
  @PostMapping('/single')
  async uploadSingle(
    @RequestPart('file') file: MultipartFile,
  ): Promise<object> {
    if (file.isEmpty()) throw new Error('No file uploaded');
    return {
      filename: file.getOriginalFilename(),
      type:     file.getContentType(),
      size:     file.getSize(),
    };
  }

  /** 多文件上传（同一接口两个字段） */
  @PostMapping('/multi')
  async uploadMulti(
    @RequestPart('document')  document:  MultipartFile,
    @RequestPart('thumbnail') thumbnail: MultipartFile,
  ): Promise<object> {
    // 保存到本地磁盘
    await document.transferTo(`/tmp/${document.getOriginalFilename()}`);
    await thumbnail.transferTo(`/tmp/${thumbnail.getOriginalFilename()}`);
    return { saved: [document.getOriginalFilename(), thumbnail.getOriginalFilename()] };
  }
}
```

**curl 测试：**

```bash
# 单文件
curl -X POST http://localhost:3003/api/upload/single \
  -F "file=@photo.png"

# 多文件
curl -X POST http://localhost:3003/api/upload/multi \
  -F "document=@doc.pdf" \
  -F "thumbnail=@thumb.png"
```

---

## 二、参数装饰器 — `@ModelAttribute` + `@RequestAttribute`

### 功能概述

两个补充参数装饰器，覆盖 Spring MVC 中除 `@RequestParam` / `@RequestBody` / `@PathVariable` 之外的常见场景：

| TypeScript 装饰器 | Java Spring 对应 | 使用场景 |
|---|---|---|
| `@ModelAttribute(name?)` | `@ModelAttribute` | 将 URL query string 与 form body 合并注入为一个对象 DTO，适合多可选参数的搜索接口和 HTML 表单提交 |
| `@RequestAttribute(name)` | `@RequestAttribute` | 读取 Express 中间件写入 `req` 对象的自定义属性（如认证信息 `req.currentUser`、租户 ID `req.tenantId`） |

### 开发思路

#### `@ModelAttribute`

- Spring MVC 中 `@ModelAttribute` 将整个模型（query + body）绑定为一个对象，避免为每个可选字段逐一写 `@RequestParam`。
- 框架实现：在路由处理器内将 `req.query` 与 `req.body` 做浅合并（`{ ...req.query, ...req.body }`），将结果注入到标注了 `@ModelAttribute` 的参数。

#### `@RequestAttribute`

- Spring MVC 的 `HandlerInterceptor.preHandle` 可向 `request` 对象写入属性，控制器通过 `@RequestAttribute` 读取。
- Express 中间件同样可以向 `req` 对象写入属性。`@RequestAttribute(name)` 直接从 `req[name]` 读取并注入参数，不需要控制器感知中间件实现。

### 技术实现

#### `@ModelAttribute` 装饰器（`@ai-first/nextjs`）

```typescript
export function ModelAttribute(name?: string) {
  return function (target: any, propertyKey: string, parameterIndex: number) {
    const modelAttrs = Reflect.getMetadata(MODEL_ATTRIBUTE_METADATA, target, propertyKey) || {};
    modelAttrs[parameterIndex] = { name: name || '' };
    Reflect.defineMetadata(MODEL_ATTRIBUTE_METADATA, modelAttrs, target, propertyKey);
  };
}
```

路由处理器内注入逻辑：

```typescript
for (const idx of Object.keys(modelAttrs)) {
  const queryObj = req.query || {};
  const bodyObj  = (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body))
    ? req.body : {};
  args[Number(idx)] = { ...queryObj, ...bodyObj };   // query 优先级低于 body
}
```

#### `@RequestAttribute` 装饰器（`@ai-first/nextjs`）

```typescript
export function RequestAttribute(name: string) {
  return function (target: any, propertyKey: string, parameterIndex: number) {
    const reqAttrs = Reflect.getMetadata(REQUEST_ATTRIBUTE_METADATA, target, propertyKey) || {};
    reqAttrs[parameterIndex] = { name };
    Reflect.defineMetadata(REQUEST_ATTRIBUTE_METADATA, reqAttrs, target, propertyKey);
  };
}
```

路由处理器内注入逻辑：

```typescript
for (const [idx, attr] of Object.entries(requestAttrs)) {
  const { name } = attr as { name: string };
  args[Number(idx)] = req[name];   // 直接读取 Express req 对象上的属性
}
```

### 快速开始

#### `@ModelAttribute` — 搜索接口 / 表单绑定

```typescript
import { RestController, GetMapping, PostMapping, ModelAttribute } from '@ai-first/nextjs';

interface SearchDto  { keyword?: string; page?: string; category?: string }
interface RegisterDto { username?: string; email?: string }

@RestController({ path: '/form' })
export class FormController {
  /** GET /api/form/search?keyword=alice&page=1&category=admin */
  @GetMapping('/search')
  search(@ModelAttribute() query: SearchDto): object {
    return { keyword: query.keyword, page: Number(query.page ?? 1) };
  }

  /** POST /api/form/register  (Content-Type: application/x-www-form-urlencoded) */
  @PostMapping('/register')
  register(@ModelAttribute('user') dto: RegisterDto): object {
    return { username: dto.username, email: dto.email };
  }
}
```

```bash
# URL 查询参数 → @ModelAttribute
curl "http://localhost:3003/api/form/search?keyword=alice&page=2"

# form-urlencoded body → @ModelAttribute
curl -X POST http://localhost:3003/api/form/register \
  -d "username=alice&email=alice@example.com"
```

#### `@RequestAttribute` — 读取中间件注入属性

```typescript
// Express 外层应用中注册认证中间件
app.use((req, _res, next) => {
  (req as any).currentUser = { id: 1, name: 'Alice', role: 'admin' };
  (req as any).tenantId    = 'tenant-42';
  next();
});

// 控制器直接声明依赖，无需感知中间件实现
import { RestController, GetMapping, RequestAttribute } from '@ai-first/nextjs';

@RestController({ path: '/form' })
export class FormController {
  @GetMapping('/profile')
  profile(
    @RequestAttribute('currentUser') user: { id: number; name: string; role: string },
  ): object {
    return { user };
  }

  /** 同一方法可使用多个 @RequestAttribute */
  @GetMapping('/tenant-info')
  tenantInfo(
    @RequestAttribute('tenantId')    tenantId: string,
    @RequestAttribute('currentUser') user: object,
  ): object {
    return { tenantId, user };
  }
}
```

```bash
curl http://localhost:3003/api/form/profile
curl http://localhost:3003/api/form/tenant-info
```

---

## 三、异步与响应式支持 — `@Async`

### 功能概述

`@Async` 来自 `@ai-first/core`，对应 Spring Boot 的 `@Async`（fire-and-forget 语义）：

- 调用方**立即**收到 `void` 返回值，HTTP 响应几乎在 0ms 内返回。
- 被装饰方法的真实逻辑通过 `setImmediate` 在下一个事件循环 tick 中执行，与调用方的执行路径完全解耦。
- 支持通过 `onError` 选项自定义后台异常处理器，后台异常不会影响调用方，也不会造成未处理的 Promise 拒绝。

| TypeScript | Java Spring 对应 |
|---|---|
| `@Async()` | `@Async`（返回 `void`，fire-and-forget） |
| `@Async({ onError })` | `@Async` + `AsyncUncaughtExceptionHandler` |

### 开发思路

1. **装饰器包装原方法**：`@Async` 将原始方法替换为一个立即返回 `void` 的同步函数，原始逻辑被推入 `setImmediate` 队列。
2. **错误隔离**：通过 `try/catch` 包裹后台逻辑；若用户未提供 `onError`，则使用默认的 `console.error` 处理器。这确保后台任务的任何异常都不会变成未处理的 Promise 拒绝，也不会向调用方传播。
3. **DI 兼容**：`@Async` 仅修改方法描述符，与 `@Service` / `@Component` 正交，可同时使用，无需特殊配置。

### 技术实现

#### `AsyncOptions` 类型（`@ai-first/core`）

```typescript
export interface AsyncOptions {
  /**
   * 后台任务抛出未处理异常时的回调。
   * 默认行为：console.error
   */
  onError?: (error: unknown, methodName: string) => void;
}
```

#### `@Async` 装饰器实现（`packages/core/src/decorators.ts`）

```typescript
export function Async(options: AsyncOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(ASYNC_METADATA, { ...options }, target, propertyKey);

    const original = descriptor.value;
    descriptor.value = function (this: any, ...args: any[]) {
      const ctx = this;
      setImmediate(async () => {
        try {
          await original.apply(ctx, args);
        } catch (error) {
          const handler = options.onError ?? defaultAsyncErrorHandler;
          handler(error, propertyKey);
        }
      });
      // 立即返回 void — fire-and-forget
    };
    return descriptor;
  };
}

function defaultAsyncErrorHandler(error: unknown, methodName: string): void {
  console.error(`[Async] Unhandled error in background task "${methodName}":`, error);
}
```

### 快速开始

#### 基本用法 — fire-and-forget 邮件通知

```typescript
import { Service, Async } from '@ai-first/core';

@Service()
export class NotificationService {
  /** 发送欢迎邮件 — 调用方不等待，立即返回 void */
  @Async()
  async sendWelcomeEmail(to: string, userId: number): Promise<void> {
    await sendMailViaSmtp(to, `Welcome, user #${userId}`);   // 真实 I/O，~500ms
    console.log(`[Notification] Welcome email sent to ${to}`);
  }
}
```

```typescript
// 控制器：调用异步服务，returnedInMs ≈ 0
@RestController({ path: '/user' })
export class UserController {
  @Autowired() private notificationService!: NotificationService;

  @PostMapping('/register')
  async register(@RequestBody() dto: { email: string; id: number }): Promise<object> {
    const t0 = Date.now();
    this.notificationService.sendWelcomeEmail(dto.email, dto.id);  // fire-and-forget
    return { message: 'Registered', returnedInMs: Date.now() - t0 };
  }
}
```

#### 自定义错误处理 — `onError`

```typescript
import { Service, Async } from '@ai-first/core';

@Service()
export class ReportService {
  /**
   * 生成报告（1s 重计算）— 失败时由 onError 捕获，调用方不受影响
   */
  @Async({
    onError: (err, method) => {
      console.error(`[ReportService] Custom onError in "${method}":`, (err as Error).message);
      // 可进一步：发送告警、写入监控系统等
    },
  })
  async generateSalesReport(month: string): Promise<void> {
    await heavyComputation(month);
    if (noData) throw new Error('Data source unavailable');
  }
}
```

#### curl 测试（基于示例应用）

```bash
# 触发 fire-and-forget 邮件任务（returnedInMs ≈ 0）
curl -X POST http://localhost:3003/api/async/send-email \
  -H "Content-Type: application/json" \
  -d '{"to":"alice@example.com","userId":42}'

# 1s 后查看后台任务执行日志
sleep 1 && curl http://localhost:3003/api/async/log

# 触发必然失败任务 — 调用方仍收到 200 OK
curl -X POST http://localhost:3003/api/async/trigger-error \
  -H "Content-Type: application/json" \
  -d '{"reportType":"quarterly"}'
```

---

## 四、功能对照表

| 功能 | 装饰器 / 类型 | 所在包 | Spring Boot 对应 |
|---|---|---|---|
| 文件上传字段注入 | `@RequestPart(name?)` | `@ai-first/nextjs` | `@RequestPart` |
| 上传文件抽象接口 | `MultipartFile` | `@ai-first/nextjs` | `org.springframework.web.multipart.MultipartFile` |
| 表单 / query 对象绑定 | `@ModelAttribute(name?)` | `@ai-first/nextjs` | `@ModelAttribute` |
| 中间件属性注入 | `@RequestAttribute(name)` | `@ai-first/nextjs` | `@RequestAttribute` |
| fire-and-forget 后台任务 | `@Async(options?)` | `@ai-first/core` | `@Async` |
| 后台异常处理 | `AsyncOptions.onError` | `@ai-first/core` | `AsyncUncaughtExceptionHandler` |

---

## 五、安装与运行示例

```bash
# 1. 安装依赖（仓库根目录）
pnpm install

# 2. 构建所有 @ai-first/* 包
pnpm --filter "@ai-first/*" build

# 3. 启动示例应用
cd app/examples/api-new-feature
pnpm dev
# → http://localhost:3003
```

> **注意（Windows）**：`package.json` 中的 `pnpm --filter` 需使用双引号，不可使用单引号（`cmd.exe` 不识别单引号为字符串定界符）。示例目录的 `predev` 脚本已正确配置。
