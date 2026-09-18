"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PublicCommunity } from "@/lib/domain/types";
import { monthLabel, shiftMonth } from "@/lib/domain/dates";
import { euros } from "@/lib/domain/money";
export function ExpenseChart({
  state,
  month,
  detailed = false,
}: {
  state: PublicCommunity;
  month: string;
  detailed?: boolean;
}) {
  const data = Array.from({ length: detailed ? 12 : 6 }, (_, i) => {
    const key = shiftMonth(month, i - (detailed ? 11 : 5)),
      expenses = state.expenses.filter((e) => e.month === key);
    return {
      month: key,
      label: monthLabel(key, true).replace(".", ""),
      total: expenses.reduce((s, e) => s + e.amount, 0) / 100,
      ...Object.fromEntries(
        state.categories.map((c) => [
          c.id,
          expenses
            .filter((e) => e.categoryId === c.id)
            .reduce((s, e) => s + e.amount, 0) / 100,
        ]),
      ),
    };
  });
  return (
    <>
      <div
        className="chart-container"
        role="img"
        aria-label={`Evolución del gasto mensual. Este mes: ${euros(data.at(-1)!.total * 100)}`}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 500, height: 210 }}
        >
          <BarChart
            data={data}
            margin={{ left: -20, right: 4, top: 12, bottom: 0 }}
            barCategoryGap="32%"
          >
            <CartesianGrid
              vertical={false}
              stroke="#EEECE8"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#827F79" }}
              dy={7}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#827F79" }}
              tickFormatter={(v) => `${v} €`}
            />
            <Tooltip
              cursor={{ fill: "#F7F5F2" }}
              formatter={(v, name) => [euros(Number(v) * 100), String(name)]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #eae7e1",
                fontSize: 12,
              }}
            />
            {detailed ? (
              state.categories.map((c) => (
                <Bar
                  key={c.id}
                  dataKey={c.id}
                  name={c.name}
                  stackId="expenses"
                  fill={c.color}
                  maxBarSize={30}
                />
              ))
            ) : (
              <Bar
                dataKey="total"
                name="Gastos del piso"
                fill="#D99B8D"
                radius={[5, 5, 0, 0]}
                maxBarSize={36}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {detailed && (
        <div className="chart-legend">
          {state.categories.map((c) => (
            <span key={c.id}>
              <i style={{ background: c.color }} />
              {c.name}
            </span>
          ))}
        </div>
      )}
      <details className="chart-data">
        <summary>Ver datos de la gráfica</summary>
        <table>
          <caption className="sr-only">Gastos por mes y categoría</caption>
          <thead>
            <tr>
              <th>Mes</th>
              {detailed &&
                state.categories.map((c) => <th key={c.id}>{c.name}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.month}>
                <td>{monthLabel(d.month)}</td>
                {detailed &&
                  state.categories.map((c) => (
                    <td key={c.id}>
                      {euros(
                        Number((d as Record<string, unknown>)[c.id]) * 100,
                      )}
                    </td>
                  ))}
                <td>{euros(d.total * 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
