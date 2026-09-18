import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { demoMode } from "@/lib/server/config";
import {
  consumeRateLimit,
  findInvite,
  insertCommunity,
} from "@/lib/server/repository";
import { hashToken } from "@/lib/server/crypto";
import { demoCommunity } from "@/lib/domain/seed";
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
    }),
    Credentials({
      id: "invite",
      credentials: { token: {} },
      async authorize(credentials, request) {
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
      if (account?.provider === "google")
        token.ownerKey = `google:${account.providerAccountId}`;
      if (user && account?.provider !== "google") {
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
      return session;
    },
  },
});
