import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireContext } from "@/lib/server/session";
import { requireAdmin } from "@/lib/domain/permissions";
import { randomToken, hashToken } from "@/lib/server/crypto";
import { appUrl } from "@/lib/server/config";
export async function GET() {
  try {
    const { member, actor } = await requireContext();
    requireAdmin(member);
    if (!process.env.AUTH_GOOGLE_ID || !process.env.TOKEN_ENCRYPTION_KEY)
      return NextResponse.redirect(`${appUrl()}/settings?google=configuration`);
    const state = randomToken(),
      verifier = randomToken();
    (await cookies()).set(
      "fm_google_oauth",
      JSON.stringify({ state, verifier, communityId: actor.communityId }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/api/google",
      },
    );
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID,
      redirect_uri: `${appUrl()}/api/google/callback`,
      response_type: "code",
      scope:
        "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      access_type: "offline",
      prompt: "consent",
      state,
      code_challenge: Buffer.from(hashToken(verifier), "hex").toString(
        "base64url",
      ),
      code_challenge_method: "S256",
    }).toString();
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(`${appUrl()}/login`);
  }
}
