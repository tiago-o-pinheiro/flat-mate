import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { listCommunityIds, mutateCommunity } from "@/lib/server/repository";
import { materializeRotations } from "@/lib/domain/commands";
import { syncCommunity } from "@/lib/server/google";
export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`,
    provided = request.headers.get("authorization") ?? "";
  if (
    !process.env.CRON_SECRET ||
    Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  )
    return new NextResponse("Unauthorized", { status: 401 });
  const ids = await listCommunityIds(),
    failures: string[] = [],
    deadline = Date.now() + 25000;
  let processed = 0;
  for (const id of ids) {
    try {
      await mutateCommunity(id, (state) => materializeRotations(state));
    } catch {
      failures.push(id);
    }
  }
  for (const id of ids) {
    if (Date.now() >= deadline) break;
    try {
      await syncCommunity(id, deadline);
      processed++;
    } catch {
      failures.push(id);
    }
  }
  return NextResponse.json(
    {
      communities: ids.length,
      processed,
      deferred: ids.length - processed,
      failures,
    },
    { status: failures.length ? 500 : 200 },
  );
}
