import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.ts';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb() {
  if (_db) return _db;
  const url = import.meta.env?.DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  _db = drizzle(neon(url), { schema });
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_t, prop) {
    const real = getDb() as any;
    const v = real[prop];
    return typeof v === 'function' ? v.bind(real) : v;
  },
});

export { schema };
