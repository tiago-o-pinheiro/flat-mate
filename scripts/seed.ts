import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { communities } from "../src/lib/db/schema";
import { demoCommunity } from "../src/lib/domain/seed";
config({ path: ".env.local" });
config();
if (!process.env.DATABASE_URL || !process.env.SEED_GOOGLE_SUB)
  throw new Error(
    "Define DATABASE_URL y SEED_GOOGLE_SUB (ID de tu cuenta Google). Usa una base de datos de pruebas.",
  );
const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  const state = demoCommunity(`google:${process.env.SEED_GOOGLE_SUB}`);
  await drizzle(client)
    .insert(communities)
    .values({ id: state.id, ownerKey: state.ownerKey, state });
  console.log(`Comunidad de ejemplo creada: ${state.id}`);
} finally {
  await client.end();
}
