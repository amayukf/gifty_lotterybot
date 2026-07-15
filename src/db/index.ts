import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from './schema.js';

export function createDatabase() {
  const dbPath = process.env.DB_PATH ?? 'data/lucky100.sqlite';
  const filePath = dbPath.startsWith('file:') ? dbPath.slice(5) : dbPath;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const url = dbPath.startsWith('file:') || dbPath.startsWith('libsql:') ? dbPath : `file:${filePath}`;
  const client = createClient({ url });
  return drizzle(client, { schema });
}
