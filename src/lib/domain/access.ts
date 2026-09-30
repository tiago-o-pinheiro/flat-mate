import { PublicError } from "./errors";
import type { Community } from "./types";

export function bindGoogleInvite(
  state: Community,
  hash: string,
  sub: string,
  email?: string | null,
) {
  const invited = state.members.find(
    (m) => m.inviteHash === hash && m.active && m.role === "member",
  );
  if (!invited) throw new PublicError("La invitación ya se ha utilizado.");
  if (state.members.some((m) => m.googleSub === sub && m.id !== invited.id))
    throw new PublicError(
      "Esta cuenta de Google ya pertenece a otra persona de la casa.",
    );
  invited.googleSub = sub;
  invited.googleEmail = email ?? undefined;
  delete invited.inviteHash;
  return { id: invited.id, accessVersion: invited.accessVersion };
}

export function consumePersonalShareToken(
  state: Community,
  hash: string,
  memberId: string,
  now = new Date(),
) {
  const link = state.shareTokens?.find((s) => s.hash === hash && !s.usedAt);
  if (!link || link.memberId !== memberId)
    throw new PublicError(
      "El enlace ya se ha utilizado o pertenece a otra persona.",
    );
  link.usedAt = now.toISOString();
  return link.month;
}
