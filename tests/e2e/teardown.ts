import { rm } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { tmpdir } from "node:os";
export default async function teardown() {
  const dir = process.env.FLATMATE_TEST_DIR;
  if (
    dir &&
    dirname(dir) === tmpdir().replace(/\/$/, "") &&
    basename(dir).startsWith("flatmate-e2e-")
  )
    await rm(dir, { recursive: true, force: true });
}
