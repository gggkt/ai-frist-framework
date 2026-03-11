/**
 * 日志工厂 - 单例模式管理日志记录器
 */

import { Logger } from './logger';
import { LogAutoConfiguration } from './auto-configuration';
import type { ILogger, LogLevel, LoggerFactoryOptions, LogConfig } from './types';

/**
 * 日志工厂
 * 单例模式，统一管理所有日志记录器
 */
export class LoggerFactory {
  private static instance: LoggerFactory | null = null;
  private readonly loggers: Map<string, ILogger> = new Map();
  private options: LoggerFactoryOptions;

  private constructor(options?: LoggerFactoryOptions) {
    this.options = options ?? {};
  }

  /** 获取单例实例 */
  static getInstance(options?: LoggerFactoryOptions): LoggerFactory {
    if (!LoggerFactory.instance) {
      LoggerFactory.instance = new LoggerFactory(options);
    } else if (options) {
      // 如果实例已存在且有新选项，更新配置
      LoggerFactory.instance.init(options);
    }
    return LoggerFactory.instance;
  }

  /** 重置工厂 */
  static reset(): void {
    if (LoggerFactory.instance) {
      LoggerFactory.instance.close();
      LoggerFactory.instance = null;
    }
  }

  /** 从配置创建工厂 */
  static fromConfig(config: LogConfig): LoggerFactory {
    LoggerFactory.instance = new LoggerFactory({
      level: config.level,
      format: config.format,
      transports: config.transports,
      defaultMeta: config.defaultMeta,
      colorize: config.colorize,
      timestamp: config.timestamp,
    });
    return LoggerFactory.instance;
  }

  /** 从 aiko-boot 配置系统创建工厂 */
  static async fromAikoBoot(): Promise<LoggerFactory> {
    try {
      // 尝试从依赖注入容器获取 LogAutoConfiguration 实例
      const { getApplicationContext } = await import('@ai-partner-x/aiko-boot/boot');
      const context = getApplicationContext();
      if (context) {
        // 使用类型断言，因为 getBean 可能不存在于类型定义中
        const autoConfig = (context as any).getBean?.(LogAutoConfiguration);
        if (autoConfig) {
          return LoggerFactory.fromConfig(autoConfig.getConfig());
        }
      }
    } catch (error) {
      // 如果无法从容器获取，创建新实例
      console.warn('无法从应用上下文获取 LogAutoConfiguration，创建新实例:', error);
    }
    
    // 创建新实例作为后备方案
    const autoConfig = new LogAutoConfiguration();
    return LoggerFactory.fromConfig(autoConfig.getConfig());
  }

  /** 自动加载配置 */
  static async autoLoad(): Promise<LoggerFactory> {
    return LoggerFactory.fromAikoBoot();
  }

  /**
   * 初始化工厂配置
   * @param options 新的工厂配置
   */
  init(options?: LoggerFactoryOptions): void {
    this.options = options ?? {};
    // 更新现有记录器的配置
    this.loggers.forEach(logger => {
      if (logger instanceof Logger) {
        // 这里可以更新现有记录器的配置，但需要 Logger 类支持配置更新
        // 目前只更新新创建的记录器
      }
    });
  }

  /**
   * 创建新的日志记录器（getLogger 的别名）
   * @param name 记录器名称
   * @param options 可选配置
   */
  createLogger(name: string, options?: Partial<LoggerFactoryOptions>): ILogger {
    return this.getLogger(name, options);
  }

  /**
   * 获取或创建日志记录器
   * @param name 记录器名称
   * @param options 可选配置
   */
  getLogger(name: string, options?: Partial<LoggerFactoryOptions>): ILogger {
    if (!this.loggers.has(name)) {
      this.loggers.set(name, new Logger({
        name,
        level: options?.level ?? this.options.level,
        defaultMeta: { ...this.options.defaultMeta, ...options?.defaultMeta },
        transports: options?.transports ?? this.options.transports,
        format: options?.format ?? this.options.format,
        colorize: options?.colorize ?? this.options.colorize,
        timestamp: options?.timestamp ?? this.options.timestamp,
      }));
    }
    return this.loggers.get(name)!;
  }

  /** 设置全局日志级别 */
  setLevel(level: LogLevel): void {
    this.options = { ...this.options, level };
    this.loggers.forEach(logger => {
      if (logger instanceof Logger) logger.setLevel(level);
    });
  }

  /** 检查记录器是否存在 */
  hasLogger(name: string): boolean {
    return this.loggers.has(name);
  }

  /** 移除记录器 */
  removeLogger(name: string): boolean {
    const logger = this.loggers.get(name);
    if (logger) {
      if (logger instanceof Logger) logger.close();
      return this.loggers.delete(name);
    }
    return false;
  }

  /** 获取所有记录器名称 */
  getLoggerNames(): string[] {
    return Array.from(this.loggers.keys());
  }

  /** 获取所有记录器实例 */
  getAllLoggers(): ILogger[] {
    return Array.from(this.loggers.values());
  }

  /** 重置工厂（实例方法） */
  reset(): void {
    this.close();
    this.options = {};
  }

  /** 关闭工厂（closeAll 的别名） */
  close(): void {
    this.loggers.forEach(logger => {
      if (logger instanceof Logger) logger.close();
    });
    this.loggers.clear();
  }

  /** 关闭所有记录器（close 的别名） */
  closeAll(): void {
    this.close();
  }
}