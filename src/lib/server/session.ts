import { PublicError } from "../domain/errors";
import { auth } from "@/auth";
import { findOwner, readCommunity } from "./repository";
import { requireMember } from "../domain/permissions";
import type { Actor } from "../domain/types";
import { demoMode } from "./config";
export async function context() {
  const session = await auth();
  if (!session?.user) return null;
  if (
    !demoMode() &&
    session.user.authProvider !== "google" &&
    !session.user.ownerKey?.startsWith("google:")
  )
    return null;
  if (session.user.ownerKey) {
    const state = await findOwner(session.user.ownerKey);
    if (!state) return null;
    const member = state.members.find((m) => m.role === "admin")!;
    return {
      state,
      member,
      actor: {
        communityId: state.id,
        memberId: member.id,
        accessVersion: member.accessVersion,
      } satisfies Actor,
    };
  }
  if (!session.user.communityId || !session.user.memberId) return null;
  const state = await readCommunity(session.user.communityId);
  if (!state) return null;
  const actor = {
    communityId: state.id,
    memberId: session.user.memberId,
    accessVersion: session.user.accessVersion ?? -1,
  };
  try {
    return { state, actor, member: requireMember(state, actor) };
  } catch {
    return null;
  }
}
export async function requireContext() {
  const ctx = await context();
  if (!ctx)
    throw new PublicError(
      "Tu sesión ha caducado. Vuelve a entrar con tu enlace.",
    );
  return ctx;
}
