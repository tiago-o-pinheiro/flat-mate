import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import lockfile from "proper-lockfile";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { communities, rateLimits } from "../db/schema";
import type { Community } from "../domain/types";
import { demoMode } from "./config";
type LocalData = {
  communities: Community[];
  limits: Record<string, { count: number; reset: number }>;
};
const dataFile = () =>
  path.join(
    process.env.DEMO_DATA_DIR ||
      (process.env.VERCEL
        ? "/tmp/flatmate-demo"
        : path.join(process.cwd(), ".data")),
    "data.json",
  );
async function local<T>(
  fn: (data: LocalData) => T | Promise<T>,
  write = false,
): Promise<T> {
  const file = dataFile();
  await mkdir(path.dirname(file), { recursive: true });
  try {
    await writeFile(file, JSON.stringify({ communities: [], limits: {} }), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  const release = await lockfile.lock(file, {
    realpath: false,
    retries: { retries: 30, minTimeout: 20, maxTimeout: 150 },
    stale: 15000,
  });
  try {
    const data = JSON.parse(await readFile(file, "utf8")) as LocalData;
    const result = await fn(data);
    if (write) {
      const temp = `${file}.${crypto.randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(data), { mode: 0o600 });
      await rename(temp, file);
    }
    return result;
  } finally {
    await release();
  }
}
export async function readCommunity(id: string): Promise<Community | null> {
  if (demoMode())
    return local((d) => d.communities.find((c) => c.id === id) ?? null);
  return (
    (
      await db()
        .select()
        .from(communities)
        .where(eq(communities.id, id))
        .limit(1)
    )[0]?.state ?? null
  );
}
export async function findOwner(ownerKey: string): Promise<Community | null> {
  if (demoMode())
    return local(
      (d) => d.communities.find((c) => c.ownerKey === ownerKey) ?? null,
    );
  return (
    (
      await db()
        .select()
        .from(communities)
        .where(eq(communities.ownerKey, ownerKey))
        .limit(1)
    )[0]?.state ?? null
  );
}
export async function findInvite(hash: string): Promise<Community | null> {
  if (demoMode())
    return local(
      (d) =>
        d.communities.find((c) =>
          c.members.some((m) => m.inviteHash === hash && m.active),
        ) ?? null,
    );
  return (
    (
      await db()
        .select()
        .from(communities)
        .where(
          sql`${communities.state}->'members' @> ${JSON.stringify([{ inviteHash: hash, active: true }])}::jsonb`,
        )
        .limit(1)
    )[0]?.state ?? null
  );
}
export async function findGoogleMember(sub: string): Promise<Community | null> {
  if (demoMode())
    return local(
      (d) =>
        d.communities.find((c) =>
          c.members.some((m) => m.googleSub === sub && m.active),
        ) ?? null,
    );
  return (
    (
      await db()
        .select()
        .from(communities)
        .where(
          sql`${communities.state}->'members' @> ${JSON.stringify([{ googleSub: sub, active: true }])}::jsonb`,
        )
        .limit(1)
    )[0]?.state ?? null
  );
}
export async function insertCommunity(state: Community) {
  if (demoMode())
    return local((d) => {
      d.communities.push(state);
    }, true);
  await db()
    .insert(communities)
    .values({ id: state.id, ownerKey: state.ownerKey, state });
}
export async function mutateCommunity<T>(
  id: string,
  fn: (state: Community) => T,
): Promise<T> {
  if (demoMode())
    return local((d) => {
      const state = d.communities.find((c) => c.id === id);
      if (!state) throw new Error("La comunidad no existe.");
      return fn(state);
    }, true);
  return db().transaction(async (tx) => {
    const row = (
      await tx
        .select()
        .from(communities)
        .where(eq(communities.id, id))
        .for("update")
    )[0];
    if (!row) throw new Error("La comunidad no existe.");
    const result = fn(row.state);
    await tx
      .update(communities)
      .set({ state: row.state, updatedAt: new Date() })
      .where(eq(communities.id, id));
    return result;
  });
}
export async function listCommunityIds() {
  if (demoMode())
    return local((d) =>
      [...d.communities]
        .sort((a, b) =>
          (a.google.lastSync ?? "").localeCompare(b.google.lastSync ?? ""),
        )
        .map((c) => c.id),
    );
  return (
    await db()
      .select({ id: communities.id })
      .from(communities)
      .orderBy(sql`coalesce(${communities.state}->'google'->>'lastSync', '')`)
  ).map((c) => c.id);
}
export async function consumeRateLimit(
  key: string,
  max = 20,
  windowMs = 900000,
) {
  const now = Date.now();
  if (demoMode())
    return local((d) => {
      for (const [k, v] of Object.entries(d.limits))
        if (v.reset <= now) delete d.limits[k];
      const bucket = d.limits[key] ?? { count: 0, reset: now + windowMs };
      bucket.count++;
      d.limits[key] = bucket;
      return bucket.count <= max;
    }, true);
  const reset = new Date(now + windowMs);
  const row = await db()
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: reset })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.resetAt} <= now() THEN 1 ELSE ${rateLimits.count} + 1 END`,
        resetAt: sql`CASE WHEN ${rateLimits.resetAt} <= now() THEN ${reset.toISOString()}::timestamptz ELSE ${rateLimits.resetAt} END`,
      },
    })
    .returning();
  return row[0].count <= max;
}
