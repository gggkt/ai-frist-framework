/**
 * 初始化 SQLite 数据库表结构
 *
 * 运行：pnpm init-db
 *
 * 对应 Java Spring Boot: schema.sql
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../../data/storage_example.db');

mkdirSync(join(__dirname, '../../data'), { recursive: true });
mkdirSync(join(__dirname, '../../uploads'), { recursive: true });

console.log('📁 Database path:', dbPath);

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS file_records (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    key           TEXT    NOT NULL UNIQUE,
    original_name TEXT    NOT NULL,
    mime_type     TEXT    NOT NULL DEFAULT '',
    size          INTEGER NOT NULL DEFAULT 0,
    url           TEXT    NOT NULL,
    folder        TEXT,
    created_at    TEXT    DEFAULT (datetime('now'))
  )
`);

console.log('✅ Created table: file_records');

db.close();
console.log('\n🎉 Database initialization complete!');
console.log('   Run "pnpm server" to start the server.');
