/**
 * 日志记录器 - 类似 SLF4J Logger 风格
 */

import * as winston from 'winston';
import { Formatter } from './formatter';
import type { ILogger, LogLevel, LogMeta, LoggerOptions, TransportConfig } from './types';
import { LOG_LEVELS } from './types';

/** 文件大小单位映射 */
const SIZE_UNITS: Record<string, number> = {
  b: 1, k: 1024, kb: 1024,
  m: 1024 * 1024, mb: 1024 * 1024,
  g: 1024 * 1024 * 1024, gb: 1024 * 1024 * 1024,
};

/**
 * 日志记录器实现
 * 类似 SLF4J Logger 接口风格
 */
export class Logger implements ILogger {
  readonly name: string;
  private _level: LogLevel;
  private readonly winstonLogger: winston.Logger;
  private readonly defaultMeta: LogMeta;

  constructor(options: LoggerOptions) {
    this.name = options.name;
    this._level = this.validateLevel(options.level) ?? 'info';
    this.defaultMeta = options.defaultMeta ?? {};
    this.winstonLogger = this.createWinstonLogger(options);
  }

  /** 获取当前日志级别 */
  get level(): LogLevel {
    return this._level;
  }

  /** 验证日志级别有效性 */
  private validateLevel(level?: LogLevel): LogLevel | undefined {
    if (!level) return undefined;
    const validLevels = Object.keys(LOG_LEVELS) as LogLevel[];
    return validLevels.includes(level) ? level : undefined;
  }

  /** 获取底层 winston 实例（高级用法） */
  get winston(): winston.Logger {
    return this.winstonLogger;
  }

  private createWinstonLogger(options: LoggerOptions): winston.Logger {
    const { transports, format = 'cli', colorize = true } = options;

    const logger = winston.createLogger({
      levels: LOG_LEVELS,
      level: this._level,
      defaultMeta: { logger: this.name, ...this.defaultMeta },
    });

    if (transports?.length) {
      transports.filter(t => t.enabled !== false).forEach(t => {
        const transport = this.createTransport(t, format, colorize);
        if (transport) logger.add(transport);
      });
    } else {
      logger.add(new winston.transports.Console({ format: Formatter.cli(colorize) }));
    }

    return logger;
  }

  private createTransport(config: TransportConfig, defaultFormat: string, colorize: boolean): winston.transport | null {
    const format = config.format ?? defaultFormat;
    const level = config.level ?? this._level;

    switch (config.type) {
      case 'console':
        return new winston.transports.Console({
          level,
          format: format === 'json' ? Formatter.json() : Formatter.cli(colorize),
        });
      case 'file':
        return new winston.transports.File({
          level,
          filename: config.filename,
          maxsize: config.maxSize ? this.parseSize(config.maxSize) : undefined,
          maxFiles: config.maxFiles,
          format: Formatter.json(),
        });
      case 'stream':
        return new winston.transports.Stream({
          level,
          stream: config.stream,
          format: Formatter.json(),
        });
      default:
        return null;
    }
  }

  private parseSize(size: string): number {
    const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
    if (!match) throw new Error(`无效的文件大小格式: ${size}`);
    const value = parseFloat(match[1]);
    const unit = (match[2] || 'b').toLowerCase();
    return Math.floor(value * (SIZE_UNITS[unit] || 1));
  }

  private mergeMeta(meta?: LogMeta): LogMeta {
    return { ...this.defaultMeta, ...meta };
  }

  // ========== SLF4J 风格日志方法 ==========

  error(message: string, meta?: LogMeta): void;
  error(message: string, error: Error, meta?: LogMeta): void;
  error(message: string, errorOrMeta?: Error | LogMeta, meta?: LogMeta): void {
    if (errorOrMeta instanceof Error) {
      this.winstonLogger.error(message, {
        ...this.mergeMeta(meta),
        error: { name: errorOrMeta.name, message: errorOrMeta.message, stack: errorOrMeta.stack },
      });
    } else {
      this.winstonLogger.error(message, this.mergeMeta(errorOrMeta));
    }
  }

  warn(message: string, meta?: LogMeta): void {
    this.winstonLogger.warn(message, this.mergeMeta(meta));
  }

  info(message: string, meta?: LogMeta): void {
    this.winstonLogger.info(message, this.mergeMeta(meta));
  }

  http(message: string, meta?: LogMeta): void {
    this.winstonLogger.http(message, this.mergeMeta(meta));
  }

  verbose(message: string, meta?: LogMeta): void {
    this.winstonLogger.verbose(message, this.mergeMeta(meta));
  }

  debug(message: string, meta?: LogMeta): void {
    this.winstonLogger.debug(message, this.mergeMeta(meta));
  }

  silly(message: string, meta?: LogMeta): void {
    this.winstonLogger.silly(message, this.mergeMeta(meta));
  }

  log(level: LogLevel, message: string, meta?: LogMeta): void {
    this.winstonLogger.log(level, message, this.mergeMeta(meta));
  }

  // ========== 日志级别判断（SLF4J 风格） ==========

  /** 是否启用 ERROR 级别 */
  isErrorEnabled(): boolean {
    return this.isLevelEnabled('error');
  }

  /** 是否启用 WARN 级别 */
  isWarnEnabled(): boolean {
    return this.isLevelEnabled('warn');
  }

  /** 是否启用 INFO 级别 */
  isInfoEnabled(): boolean {
    return this.isLevelEnabled('info');
  }

  /** 是否启用 DEBUG 级别 */
  isDebugEnabled(): boolean {
    return this.isLevelEnabled('debug');
  }

  /** 是否启用 TRACE 级别（对应 silly） */
  isTraceEnabled(): boolean {
    return this.isLevelEnabled('silly');
  }

  private isLevelEnabled(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this._level];
  }

  // ========== 子记录器与上下文 ==========

  /**
   * 创建子记录器
   * @param suffix 名称后缀
   */
  child(suffix: string): ILogger {
    return new Logger({
      name: `${this.name}:${suffix}`,
      level: this._level,
      defaultMeta: this.defaultMeta,
    });
  }

  /**
   * 创建带上下文的记录器
   * @param context 上下文元数据
   */
  withContext(context: LogMeta): ILogger {
    return new Logger({
      name: this.name,
      level: this._level,
      defaultMeta: { ...this.defaultMeta, ...context },
    });
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this._level = level;
    this.winstonLogger.level = level;
  }

  /**
   * 关闭日志记录器
   */
  close(): void {
    this.winstonLogger.close();
  }
}