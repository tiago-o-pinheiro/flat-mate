import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { demoMode } from "@/lib/server/config";
import {
  consumeRateLimit,
  findGoogleMember,
  findInvite,
  insertCommunity,
  mutateCommunity,
} from "@/lib/server/repository";
import { hashToken } from "@/lib/server/crypto";
import { demoCommunity } from "@/lib/domain/seed";
import { bindGoogleInvite } from "@/lib/domain/access";
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret:
    process.env.AUTH_SECRET ||
    (demoMode()
      ? "flat-mate-local-demonstration-only-never-production"
      : undefined),
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || "not-configured",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "not-configured",
      authorization: { params: { prompt: "select_account" } },
    }),
    Credentials({
      id: "invite",
      credentials: { token: {} },
      async authorize(credentials, request) {
        if (!demoMode()) return null;
        const token = credentials.token;
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
        if (!(await consumeRateLimit(`invite-ip:${hashToken(ip)}`)))
          return null;
        if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
          return null;
        const hash = hashToken(token);
        if (!(await consumeRateLimit(`invite-token:${hash}`, 30))) return null;
        const state = await findInvite(hash),
          member = state?.members.find(
            (m) => m.inviteHash === hash && m.active && m.role === "member",
          );
        if (!state || !member) return null;
        await mutateCommunity(state.id, (current) => {
          const invited = current.members.find(
            (m) => m.inviteHash === hash && m.active,
          );
          if (!invited) throw new Error("La invitación ya se ha utilizado.");
          delete invited.inviteHash;
        });
        return {
          id: member.id,
          name: member.name,
          communityId: state.id,
          memberId: member.id,
          accessVersion: member.accessVersion,
        };
      },
    }),
    Credentials({
      id: "demo",
      credentials: {},
      async authorize(_, request) {
        if (!demoMode()) return null;
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
        if (!(await consumeRateLimit(`demo:${hashToken(ip)}`, 40))) return null;
        const ownerKey = `demo:${crypto.randomUUID()}`,
          state = demoCommunity(ownerKey);
        await insertCommunity(state);
        return { id: state.members[0].id, name: "Tiago", ownerKey };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === "google") {
        token.authProvider = "google";
        const sub = account.providerAccountId;
        const pending = (await cookies()).get("fm_pending_invite")?.value;
        if (pending) {
          const hash = hashToken(pending);
          const state = await findInvite(hash);
          if (!state) throw new Error("La invitación ya no es válida.");
          const previous = await findGoogleMember(sub);
          if (previous && previous.id !== state.id)
            throw new Error(
              "Esta cuenta de Google ya está vinculada a otra comunidad.",
            );
          const member = await mutateCommunity(state.id, (current) =>
            bindGoogleInvite(current, hash, sub, user.email),
          );
          (await cookies()).delete("fm_pending_invite");
          token.ownerKey = undefined;
          token.communityId = state.id;
          token.memberId = member.id;
          token.accessVersion = member.accessVersion;
        } else {
          const state = await findGoogleMember(sub);
          const member = state?.members.find(
            (m) => m.googleSub === sub && m.active,
          );
          if (state && member) {
            token.ownerKey = undefined;
            token.communityId = state.id;
            token.memberId = member.id;
            token.accessVersion = member.accessVersion;
          } else {
            token.ownerKey = `google:${sub}`;
            token.communityId = undefined;
            token.memberId = undefined;
            token.accessVersion = undefined;
          }
        }
      }
      if (user && account?.provider !== "google") {
        token.authProvider = account?.provider === "demo" ? "demo" : "invite";
        token.ownerKey = user.ownerKey;
        token.communityId = user.communityId;
        token.memberId = user.memberId;
        token.accessVersion = user.accessVersion;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.ownerKey = token.ownerKey;
      session.user.communityId = token.communityId;
      session.user.memberId = token.memberId;
      session.user.accessVersion = token.accessVersion;
      session.user.authProvider = token.authProvider;
      return session;
    },
  },
});
