/**
 * 测试环境设置
 * 在所有测试运行之前执行
 */

import { vi, beforeEach } from 'vitest';

// 模拟 console 方法以避免测试输出干扰
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

// 清理所有模拟
afterEach(() => {
  vi.restoreAllMocks();
});

// 全局测试辅助函数
globalThis.testHelpers = {
  createMockTransport: (type: 'console' | 'file' | 'stream' = 'console') => {
    switch (type) {
      case 'console':
        return {
          type: 'console' as const,
          enabled: true,
          level: 'debug' as const,
          format: 'cli' as const,
          colorize: true,
          timestamp: true
        };
      case 'file':
        return {
          type: 'file' as const,
          enabled: true,
          filename: './test.log',
          level: 'info' as const,
          maxSize: '1mb',
          maxFiles: 3
        };
      case 'stream':
        return {
          type: 'stream' as const,
          enabled: true,
          stream: {
            write: vi.fn()
          } as any,
          level: 'error' as const
        };
    }
  },
  
  createMockLoggerConfig: (name: string = 'test-logger') => ({
    name,
    level: 'debug' as const,
    defaultMeta: { test: true },
    transports: [
      {
        type: 'console' as const,
        enabled: true,
        level: 'debug' as const,
        format: 'cli' as const
      }
    ],
    format: 'cli' as const,
    colorize: true,
    timestamp: true
  }),
  
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};