/**
 * 日志门面 - 类似 SLF4J 风格
 * 提供简洁的静态方法访问日志功能
 */

import { LoggerFactory } from './loggerFactory';
import { Logger } from './logger';
import { LogAutoConfiguration, DEFAULT_CONFIG } from './auto-configuration';
import type { ILogger, LogLevel, LoggerFactoryOptions, LogConfig } from './types';

/**
 * 获取日志记录器（SLF4J 风格）
 * @param name 日志记录器名称
 */
export function getLogger(name: string): ILogger;

/**
 * 获取日志记录器（带配置选项）
 * @param name 日志记录器名称
 * @param options 配置选项
 */
export function getLogger(name: string, options?: Partial<LoggerFactoryOptions>): ILogger;

export function getLogger(name: string, options?: Partial<LoggerFactoryOptions>): ILogger {
  return LoggerFactory.getInstance().getLogger(name, options);
}

/**
 * 初始化日志工厂
 */
export function initLogging(options?: LoggerFactoryOptions): LoggerFactory {
  return LoggerFactory.getInstance(options);
}

/**
 * 从配置对象初始化
 */
export function initFromConfig(config: LogConfig): LoggerFactory {
  return LoggerFactory.fromConfig(config);
}

/**
 * 从 aiko-boot 配置系统初始化
 */
export async function initFromAikoBoot(): Promise<LoggerFactory> {
  return LoggerFactory.fromAikoBoot();
}

/**
 * 自动加载配置（从 aiko-boot 配置系统）
 */
export async function autoInit(): Promise<LoggerFactory> {
  return LoggerFactory.autoLoad();
}

/**
 * 创建控制台日志记录器
 */
export function createConsoleLogger(name: string, level: LogLevel = 'info'): ILogger {
  return new Logger({ name, level, transports: [{ type: 'console', level, format: 'cli', colorize: true }] });
}

/**
 * 创建文件日志记录器
 */
export function createFileLogger(name: string, filename: string, options?: { level?: LogLevel; maxSize?: string; maxFiles?: number }): ILogger {
  return new Logger({
    name,
    level: options?.level ?? 'info',
    transports: [{ type: 'file', filename, level: options?.level, maxSize: options?.maxSize, maxFiles: options?.maxFiles }],
  });
}

/**
 * 创建组合日志记录器（控制台 + 文件）
 */
export function createCombinedLogger(name: string, filename: string, options?: { level?: LogLevel; maxSize?: string; maxFiles?: number }): ILogger {
  return new Logger({
    name,
    level: options?.level ?? 'info',
    transports: [
      { type: 'console', level: options?.level, format: 'cli', colorize: true },
      { type: 'file', filename, level: options?.level, maxSize: options?.maxSize, maxFiles: options?.maxFiles },
    ],
  });
}

/**
 * 设置全局日志级别
 */
export function setLevel(level: LogLevel): void {
  LoggerFactory.getInstance().setLevel(level);
}

/**
 * 关闭日志工厂
 */
export function closeLogging(): void {
  LoggerFactory.reset();
}

/**
 * 加载配置
 */
export async function loadConfig(): Promise<LogConfig> {
  try {
    // 尝试从依赖注入容器获取 LogAutoConfiguration 实例
    const { getApplicationContext } = await import('@ai-partner-x/aiko-boot/boot');
    const context = getApplicationContext();
    if (context) {
      // 使用类型断言，因为 getBean 可能不存在于类型定义中
      const autoConfig = (context as any).getBean?.(LogAutoConfiguration);
      if (autoConfig) {
        return autoConfig.getConfig();
      }
    }
  } catch (error) {
    // 如果无法从容器获取，创建新实例
    console.warn('无法从应用上下文获取 LogAutoConfiguration，创建新实例:', error);
  }
  
  // 创建新实例作为后备方案
  const autoConfig = new LogAutoConfiguration();
  return autoConfig.getConfig();
}

/**
 * 获取默认配置
 */
export function getDefaultConfig(): LogConfig {
  return { ...DEFAULT_CONFIG };
}

/** 默认日志记录器 */
export const defaultLogger = createConsoleLogger('app');