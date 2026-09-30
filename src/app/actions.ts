"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import { cookies } from "next/headers";
import { auth, signIn, signOut } from "@/auth";
import { applyCommand } from "@/lib/domain/commands";
import { currentMonth } from "@/lib/domain/dates";
import { createCommunity } from "@/lib/domain/seed";
import { requireAdmin, requireMember } from "@/lib/domain/permissions";
import { requireContext } from "@/lib/server/session";
import {
  findOwner,
  findInvite,
  insertCommunity,
  mutateCommunity,
} from "@/lib/server/repository";
import { hashToken, randomToken } from "@/lib/server/crypto";
import { appUrl, demoMode } from "@/lib/server/config";
import { googleCalendars, syncCommunity } from "@/lib/server/google";
import { PublicError } from "@/lib/domain/errors";
import { consumePersonalShareToken } from "@/lib/domain/access";
export type ActionResult =
  { ok: true; value?: string } | { ok: false; error: string };
function errorMessage(e: unknown) {
  if (e instanceof z.ZodError) return "Revisa los campos del formulario.";
  return e instanceof PublicError
    ? e.message
    : "Algo no ha ido bien. Inténtalo de nuevo.";
}
export async function dispatch(command: unknown): Promise<ActionResult> {
  try {
    const { actor } = await requireContext();
    const value = await mutateCommunity(actor.communityId, (state) =>
      applyCommand(state, actor, command),
    );
    after(() => syncCommunity(actor.communityId));
    revalidatePath("/", "layout");
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
export async function generateInvite(input: {
  name?: string;
  memberId?: string;
}): Promise<ActionResult> {
  try {
    const { actor } = await requireContext(),
      token = randomToken();
    await mutateCommunity(actor.communityId, (state) => {
      requireAdmin(requireMember(state, actor));
      let member = input.memberId
        ? state.members.find(
            (m) => m.id === input.memberId && m.role === "member" && m.active,
          )
        : undefined;
      if (input.memberId && !member)
        throw new PublicError("Participante no disponible.");
      if (member?.googleSub)
        throw new PublicError(
          "Esta persona ya tiene Google vinculado. Revoca su acceso antes de crear una invitación nueva.",
        );
      if (!member) {
        const name = z.string().trim().min(1).max(80).parse(input.name);
        member = {
          id: crypto.randomUUID(),
          name,
          avatar: state.members.length % 8,
          role: "member" as const,
          active: true,
          registered: false,
          joinedMonth: currentMonth(),
          accessVersion: 0,
        };
        state.members.push(member);
      }
      member.accessVersion++;
      member.inviteHash = hashToken(token);
      state.audit.push({
        id: crypto.randomUUID(),
        authorId: actor.memberId,
        action: "member.invite",
        entityId: member.id,
        at: new Date().toISOString(),
      });
    });
    revalidatePath("/", "layout");
    return { ok: true, value: `${appUrl()}/join#${token}` };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
export async function enterInvite(token: string): Promise<ActionResult> {
  try {
    if (!demoMode()) {
      if (
        !/^[A-Za-z0-9_-]{43}$/.test(token) ||
        !(await findInvite(hashToken(token)))
      )
        throw new PublicError("El enlace no es válido o ya se ha utilizado.");
      (await cookies()).set("fm_pending_invite", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      });
      return { ok: true, value: "google" };
    }
    await signIn("invite", { token, redirect: false });
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError)
      return {
        ok: false,
        error:
          "El enlace no es válido o ha sido revocado. Pide uno nuevo al administrador.",
      };
    throw e;
  }
}
export async function enterDemo() {
  await signIn("demo", { redirectTo: "/" });
}
export async function enterGoogle() {
  await signIn("google", { redirectTo: "/" });
}
export async function enterGoogleShare() {
  await signIn("google", { redirectTo: "/share/open" });
}
export async function shareDemoMode() {
  return demoMode();
}
export async function createPersonalShareLink(input: {
  memberId: string;
  month: string;
}): Promise<ActionResult> {
  try {
    const { actor } = await requireContext();
    const token = randomToken();
    await mutateCommunity(actor.communityId, (state) => {
      requireAdmin(requireMember(state, actor));
      const member = state.members.find(
        (m) => m.id === input.memberId && m.active && m.role === "member",
      );
      if (!member || !state.boards.includes(input.month))
        throw new PublicError("El destinatario o el mes no están disponibles.");
      (state.shareTokens ??= []).push({
        id: crypto.randomUUID(),
        hash: hashToken(token),
        memberId: member.id,
        month: input.month,
        createdAt: new Date().toISOString(),
      });
    });
    return { ok: true, value: `${appUrl()}/share/open#${token}` };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
export async function redeemPersonalShareLink(
  token: string,
): Promise<ActionResult> {
  try {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new PublicError("El enlace no es válido.");
    const { actor } = await requireContext();
    const hash = hashToken(token);
    const month = await mutateCommunity(actor.communityId, (state) => {
      requireMember(state, actor);
      return consumePersonalShareToken(state, hash, actor.memberId);
    });
    return { ok: true, value: month };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
export async function logout() {
  await signOut({ redirectTo: "/login" });
}
export async function setupCommunity(form: FormData) {
  const session = await auth();
  if (!session?.user.ownerKey) redirect("/login");
  if (!(await findOwner(session.user.ownerKey))) {
    const name = z.string().trim().min(1).max(80).parse(form.get("name"));
    await insertCommunity(
      createCommunity(
        name,
        session.user.ownerKey,
        session.user.name || "Admin",
      ),
    );
  }
  redirect("/");
}
export async function listGoogleCalendars(): Promise<{
  calendars: { id: string; summary: string }[];
  error?: string;
}> {
  try {
    const { member, actor } = await requireContext();
    requireAdmin(member);
    return { calendars: await googleCalendars(actor.communityId) };
  } catch (e) {
    return { calendars: [], error: errorMessage(e) };
  }
}
export async function selectGoogleCalendar(
  calendarId: string,
): Promise<ActionResult> {
  try {
    const { member, actor } = await requireContext();
    requireAdmin(member);
    const calendar = (await googleCalendars(actor.communityId)).find(
      (c) => c.id === calendarId,
    );
    if (!calendar)
      throw new PublicError(
        "No tienes permisos de escritura en ese calendario.",
      );
    await mutateCommunity(actor.communityId, (state) => {
      requireAdmin(requireMember(state, actor));
      if (state.google.calendarId && state.google.calendarId !== calendar.id)
        throw new PublicError(
          "Desconecta el calendario actual antes de cambiarlo.",
        );
      state.google.calendarId = calendar.id;
      state.google.calendarName = calendar.summary;
    });
    after(() => syncCommunity(actor.communityId));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
export async function retryGoogle(): Promise<ActionResult> {
  try {
    const { member, actor } = await requireContext();
    requireAdmin(member);
    await syncCommunity(actor.communityId);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
export async function disconnectGoogle(): Promise<ActionResult> {
  try {
    const { actor } = await requireContext();
    await mutateCommunity(actor.communityId, (state) => {
      requireAdmin(requireMember(state, actor));
      state.google = {};
      for (const e of state.events) e.syncedVersion = 0;
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
