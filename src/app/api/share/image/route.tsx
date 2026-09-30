import { ImageResponse } from "next/og";
import { context } from "@/lib/server/session";
import { commonCard, personalCard } from "@/lib/domain/cards";
import { euros } from "@/lib/domain/money";
import { monthLabel } from "@/lib/domain/dates";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const ctx = await context();
  if (!ctx) return new Response("Acceso requerido", { status: 401 });
  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
    !ctx.state.boards.includes(month)
  )
    return new Response("Mes no disponible", { status: 404 });
  const scope = url.searchParams.get("scope");
  if (scope !== "common" && scope !== "member")
    return new Response("Tarjeta no disponible", { status: 404 });
  if (
    scope === "common" &&
    url.searchParams.get("communityId") !== ctx.state.id
  )
    return new Response("Tarjeta no disponible", { status: 404 });
  const requestedMemberId = url.searchParams.get("memberId");
  if (
    scope === "member" &&
    requestedMemberId &&
    ctx.member.role !== "admin" &&
    requestedMemberId !== ctx.member.id
  )
    return new Response("Acceso denegado", { status: 403 });
  const data =
    scope === "common"
      ? commonCard(ctx.state, month)
      : personalCard(
          ctx.state,
          requestedMemberId && ctx.member.role === "admin"
            ? requestedMemberId
            : ctx.member.id,
          month,
        );
  const personal = "name" in data;
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: 64,
        background: "#fffaf4",
        color: "#24332c",
        fontFamily: "sans-serif",
      }}
    >
      <span style={{ fontSize: 22, letterSpacing: 2, color: "#6d806f" }}>
        FLAT MATE · {data.house.toUpperCase()}
      </span>
      <span style={{ fontSize: 58, fontWeight: 700, marginTop: 38 }}>
        {personal ? `Gastos de ${data.name}` : "Gastos de la casa"}
      </span>
      <span style={{ fontSize: 28, marginTop: 12 }}>{monthLabel(month)}</span>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: "#e9f0e6",
          borderRadius: 28,
          padding: 36,
          marginTop: 48,
        }}
      >
        <span style={{ fontSize: 26 }}>
          {personal ? "Tu cuota de gastos comunes" : "Total de gastos comunes"}
        </span>
        <span style={{ fontSize: 78, fontWeight: 700, marginTop: 10 }}>
          {euros(personal ? data.commonContribution : data.total)}
        </span>
      </div>
      <span style={{ fontSize: 22, marginTop: 48 }}>
        {personal
          ? "Solo gastos comunes. El alquiler y la fianza nunca aparecen en esta tarjeta."
          : `${data.count} gastos registrados este mes`}
      </span>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="gastos-${month}.png"`,
      },
    },
  );
}
