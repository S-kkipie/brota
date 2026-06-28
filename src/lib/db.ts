import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '@/db/schema';

/**
 * Drizzle client over libSQL (SQLite).
 */
const connectionString =
  process.env.DATABASE_URL ?? "file:./local.db";

const client = createClient({
  url: connectionString,
});

export const db = drizzle(client, { schema });
export { schema };
