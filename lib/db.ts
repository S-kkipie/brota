import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

/**
 * Drizzle client over postgres.js. The connection is lazy — postgres.js does
 * not open a socket until the first query, so importing this at build time is
 * safe even without DATABASE_URL.
 */
const connectionString =
  process.env.DATABASE_URL ?? "postgres://localhost:5432/brota";

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
