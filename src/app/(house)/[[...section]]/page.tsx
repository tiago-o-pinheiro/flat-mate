import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { context } from "@/lib/server/session";
import { mutateCommunity } from "@/lib/server/repository";
import { currentMonth } from "@/lib/domain/dates";
import { materializeRotations } from "@/lib/domain/commands";
import { publicCommunity, requireMember } from "@/lib/domain/permissions";
import { Dashboard } from "@/components/dashboard";
import { demoMode } from "@/lib/server/config";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ month?: string; google?: string }>;
}) {
  const { section } = await params,
    query = await searchParams,
    view = section?.[0] || "inicio";
  if (
    (section?.length ?? 0) > 1 ||
    !["inicio", "gastos", "calendario", "tablon", "settings"].includes(view)
  )
    notFound();
  const ctx = await context();
  if (!ctx) {
    const session = await auth();
    if (session?.user.ownerKey) redirect("/onboarding");
    redirect("/login");
  }
  if (!ctx.member.registered) redirect("/welcome");
  const month =
    query.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month)
      ? query.month
      : currentMonth();
  const state = await mutateCommunity(ctx.state.id, (s) => {
    requireMember(s, ctx.actor);
    if (!s.boards.includes(currentMonth())) s.boards.push(currentMonth());
    materializeRotations(s);
    return publicCommunity(s);
  });
  return (
    <Dashboard
      state={state}
      memberId={ctx.member.id}
      month={month}
      view={view}
      demo={demoMode()}
      googleStatus={query.google}
    />
  );
}
