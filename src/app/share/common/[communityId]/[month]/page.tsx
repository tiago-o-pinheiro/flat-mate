import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { context } from "@/lib/server/session";
import { commonCard } from "@/lib/domain/cards";
import { ShareCard } from "@/components/share-card";

export const dynamic = "force-dynamic";
export default async function CommonShare({
  params,
}: {
  params: Promise<{ communityId: string; month: string }>;
}) {
  const { communityId, month } = await params;
  const ctx = await context();
  if (!ctx) redirect("/login");
  if (ctx.state.id !== communityId || !ctx.state.boards.includes(month))
    notFound();
  const data = commonCard(ctx.state, month);
  return (
    <main className="share-page">
      <ShareCard data={data} />
      <div className="share-actions">
        <a
          className="button button-secondary"
          href={`/api/share/image?scope=common&communityId=${encodeURIComponent(communityId)}&month=${encodeURIComponent(month)}`}
          download={`gastos-${month}.png`}
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
