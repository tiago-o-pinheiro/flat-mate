import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
const globalDb = globalThis as unknown as {
  flatmateSql?: ReturnType<typeof postgres>;
};
export function db() {
  if (!process.env.DATABASE_URL)
    throw new Error("Configura DATABASE_URL para conectar PostgreSQL.");
  globalDb.flatmateSql ??= postgres(process.env.DATABASE_URL, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(globalDb.flatmateSql, { schema });
}
