import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../schema.js';

let dbInstance = null;

export function getDb(env) {
  if (!dbInstance) {
    if (!env || !env.DB) {
      throw new Error('D1 Database binding "DB" was not found in wrangler.toml or env.');
    }
    dbInstance = drizzle(env.DB, { schema });
  }
  return dbInstance;
}
