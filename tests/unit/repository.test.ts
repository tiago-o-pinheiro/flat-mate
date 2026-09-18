import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  insertCommunity,
  readCommunity,
  mutateCommunity,
  consumeRateLimit,
  findInvite,
} from "../../src/lib/server/repository";
import { createCommunity } from "../../src/lib/domain/seed";
import { encrypt, decrypt, hashToken } from "../../src/lib/server/crypto";
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "flatmate-tests-"));
  process.env.DEMO_MODE = "true";
  process.env.DEMO_DATA_DIR = dir;
  process.env.TOKEN_ENCRYPTION_KEY = "ab".repeat(32);
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});
describe("persistencia y secretos", () => {
  it("serializa escrituras concurrentes sin perder cambios", async () => {
    const state = createCommunity("Casa", "owner", "Admin");
    await insertCommunity(state);
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        mutateCommunity(state.id, (s) => {
          s.announcements.push({
            id: String(i),
            authorId: s.members[0].id,
            body: String(i),
            pinned: false,
            createdAt: new Date().toISOString(),
          });
        }),
      ),
    );
    expect((await readCommunity(state.id))?.announcements).toHaveLength(12);
  });
  it("una operación fallida no persiste cambios parciales", async () => {
    const state = createCommunity("Casa", "owner", "Admin");
    await insertCommunity(state);
    await expect(
      mutateCommunity(state.id, (s) => {
        s.name = "Roto";
        throw new Error("rollback");
      }),
    ).rejects.toThrow();
    expect((await readCommunity(state.id))?.name).toBe("Casa");
  });
  it("limita intentos de forma persistente", async () => {
    expect(await consumeRateLimit("attempts", 2)).toBe(true);
    expect(await consumeRateLimit("attempts", 2)).toBe(true);
    expect(await consumeRateLimit("attempts", 2)).toBe(false);
  });
  it("busca invitaciones por hash y respeta la desactivación", async () => {
    const state = createCommunity("Casa", "owner", "Admin");
    state.members[0].inviteHash = hashToken("token");
    await insertCommunity(state);
    expect((await findInvite(hashToken("token")))?.id).toBe(state.id);
    await mutateCommunity(state.id, (s) => {
      s.members[0].active = false;
    });
    expect(await findInvite(hashToken("token"))).toBeNull();
  });
  it("cifra credenciales y detecta manipulación", () => {
    const encrypted = encrypt("refresh-secret");
    expect(encrypted).not.toContain("refresh-secret");
    expect(decrypt(encrypted)).toBe("refresh-secret");
    const modified = Buffer.from(encrypted, "base64url");
    modified[20] ^= 1;
    expect(() => decrypt(modified.toString("base64url"))).toThrow();
  });
});
