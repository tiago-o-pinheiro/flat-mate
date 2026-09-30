import { euros } from "@/lib/domain/money";
import { monthLabel } from "@/lib/domain/dates";
import type { commonCard, personalCard } from "@/lib/domain/cards";

export function ShareCard({
  data,
}: {
  data: ReturnType<typeof commonCard> | ReturnType<typeof personalCard>;
}) {
  const personal = "name" in data;
  return (
    <article className="share-card">
      <span className="eyebrow">FLAT MATE · {data.house.toUpperCase()}</span>
      <h2>{personal ? `Gastos de ${data.name}` : "Gastos de la casa"}</h2>
      <p>{monthLabel(data.month)}</p>
      <div className="share-card-total">
        <span>
          {personal ? "Tu cuota de gastos comunes" : "Total de gastos comunes"}
        </span>
        <strong>
          {euros(personal ? data.commonContribution : data.total)}
        </strong>
      </div>
      {personal ? (
        <p>
          Tu parte del gasto común: {euros(data.expenseShare)}
          {data.included
            ? " · Incluida en el alquiler"
            : data.credited
              ? ` · Adelantos descontados: ${euros(data.credited)}`
              : ""}
        </p>
      ) : (
        <div className="share-card-breakdown">
          {data.categories.map((c) => (
            <div key={c.name}>
              <span>{c.name}</span>
              <strong>{euros(c.amount)}</strong>
            </div>
          ))}
        </div>
      )}
      <small>
        {personal
          ? "Esta tarjeta solo incluye gastos comunes."
          : `${data.count} gastos registrados este mes`}
      </small>
    </article>
  );
}
