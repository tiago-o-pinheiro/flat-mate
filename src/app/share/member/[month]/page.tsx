import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { context } from "@/lib/server/session";
import { personalCard } from "@/lib/domain/cards";
import { ShareCard } from "@/components/share-card";
import { ConfirmSharedPayment } from "@/components/confirm-shared-payment";

export const dynamic = "force-dynamic";
export default async function MemberShare({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  const ctx = await context();
  if (!ctx) redirect("/login");
  if (!ctx.state.boards.includes(month)) notFound();
  const data = personalCard(ctx.state, ctx.member.id, month);
  const pendingClaim = (ctx.state.paymentClaims ?? []).some(
    (c) =>
      c.memberId === ctx.member.id &&
      c.month === month &&
      c.purpose === "shared" &&
      c.status === "pending",
  );
  return (
    <main className="share-page">
      <ShareCard data={data} />
      <ConfirmSharedPayment
        month={month}
        amount={data.commonContribution}
        pendingClaim={pendingClaim}
      />
      <div className="share-actions">
        <a
          className="button button-secondary"
          href={`/api/share/image?scope=member&month=${encodeURIComponent(month)}`}
          download={`mis-gastos-${month}.png`}
        >
          Descargar imagen
        </a>
        <Link className="button button-primary" href="/gastos">
          Abrir la app
        </Link>
      </div>
    </main>
  );
}
