import { redirect } from "next/navigation";
import { context } from "@/lib/server/session";
import { Welcome } from "@/components/welcome";
export default async function Page() {
  const ctx = await context();
  if (!ctx) redirect("/login");
  if (ctx.member.registered) redirect("/");
  return <Welcome name={ctx.member.name} house={ctx.state.name} />;
}
