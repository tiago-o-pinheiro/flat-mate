import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireContext } from "@/lib/server/session";
import { requireAdmin } from "@/lib/domain/permissions";
import { appUrl } from "@/lib/server/config";
import { storeGoogleTokens } from "@/lib/server/google";
export async function GET(request: Request) {
  const jar = await cookies(),
    saved = jar.get("fm_google_oauth")?.value;
  jar.delete({ name: "fm_google_oauth", path: "/api/google" });
  try {
    const { member, actor } = await requireContext();
    requireAdmin(member);
    const url = new URL(request.url),
      stored = saved ? JSON.parse(saved) : null;
    if (
      !stored ||
      stored.state !== url.searchParams.get("state") ||
      stored.communityId !== actor.communityId ||
      !url.searchParams.get("code")
    )
      throw new Error("Invalid OAuth state");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        code: url.searchParams.get("code")!,
        code_verifier: stored.verifier,
        grant_type: "authorization_code",
        redirect_uri: `${appUrl()}/api/google/callback`,
      }),
    });
    if (!response.ok) throw new Error("OAuth exchange failed");
    await storeGoogleTokens(actor.communityId, await response.json());
    return NextResponse.redirect(`${appUrl()}/settings?google=connected`);
  } catch {
    return NextResponse.redirect(`${appUrl()}/settings?google=error`);
  }
}
