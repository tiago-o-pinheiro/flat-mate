"use client";
import { useState } from "react";
import { currentMonth, monthLabel } from "@/lib/domain/dates";
import {
  euros,
  financeSettings,
  rentForMember,
  rentIsPaid,
} from "@/lib/domain/money";
import type { PublicCommunity } from "@/lib/domain/types";
import { Button } from "./ui/button";

export function FinancePanel({
  state,
  memberId,
  pending,
  save,
}: {
  state: PublicCommunity;
  memberId: string;
  pending: boolean;
  save: (command: unknown) => Promise<boolean>;
}) {
  const me = state.members.find((m) => m.id === memberId)!;
  const admin = me.role === "admin";
  const settings = financeSettings(state);
  const month = currentMonth();
  const [selected, setSelected] = useState(memberId);
  const [statusMonth, setStatusMonth] = useState(month);
  const [settlementMode, setSettlementMode] = useState(
    settings.defaultSettlementMode,
  );
  const [included, setIncluded] = useState(settings.expensesIncludedInRent);
  const hasUnsavedSettings =
    settlementMode !== settings.defaultSettlementMode ||
    included !== settings.expensesIncludedInRent;
  const target = state.members.find((m) => m.id === selected) ?? me;
  const deposit = settings.deposits.find((d) => d.memberId === target.id);
  const rent = rentForMember(state, target.id, month);
  return (
    <section
      className="panel settings-panel finance-panel"
      data-saved-mode={settings.defaultSettlementMode}
    >
      <div className="panel-header">
        <div>
          <h2>Mi perfil económico</h2>
          <p>Estos datos solo son visibles para ti y el administrador.</p>
        </div>
      </div>
      <div className="finance-panel-body">
        <div className="form-grid finance-profile">
          <div>
            <span className="muted">En la casa desde</span>
            <br />
            <strong>{monthLabel(me.joinedMonth)}</strong>
          </div>
          <div>
            <span className="muted">Mi alquiler mensual</span>
            <br />
            <strong>{euros(rentForMember(state, memberId, month))}</strong>
            <br />
            <small>
              {rentIsPaid(state, memberId, month) ? "Pagado" : "Pendiente"}
            </small>
          </div>
          <div>
            <span className="muted">Fianza entregada</span>
            <br />
            <strong>
              {euros(
                settings.deposits.find((d) => d.memberId === memberId)
                  ?.amount ?? 0,
              )}
            </strong>
          </div>
        </div>
        {admin && (
          <>
            <h3>Cómo se pagan los gastos</h3>
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                await save({
                  type: "finance.settings",
                  defaultSettlementMode: settlementMode,
                  expensesIncludedInRent: included,
                });
              }}
            >
              <label>
                Cuando alguien adelanta un gasto
                <select
                  name="defaultSettlementMode"
                  value={settlementMode}
                  onChange={(e) =>
                    setSettlementMode(e.target.value as "credit" | "reimburse")
                  }
                >
                  <option value="credit">Descontar anticipos de cuota</option>
                  <option value="reimburse">Cuota igual + reembolso</option>
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="expensesIncludedInRent"
                  checked={included}
                  onChange={(e) => setIncluded(e.target.checked)}
                />
                Los gastos comunes están incluidos en el alquiler
              </label>
              <Button type="submit" disabled={pending || !hasUnsavedSettings}>
                Guardar dinámica
              </Button>
              {hasUnsavedSettings && (
                <span className="finance-unsaved" role="status">
                  Este cambio se aplicará al guardar.
                </span>
              )}
            </form>
            <p className="finance-setting-note">
              {settlementMode === "reimburse"
                ? "Todos mantienen su cuota de gastos. Si alguien paga un recibo, el administrador le devuelve el importe completo por separado."
                : "Los recibos adelantados se descuentan del saldo con el administrador; quien pagó puede quedar con menos por pagar o con saldo a favor."}{" "}
              Al cambiar esta dinámica se recalculan también los gastos ya
              registrados.
            </p>
            <h3>Alquiler y fianza por inquilino</h3>
            <label>
              Persona
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {state.members
                  .filter((m) => m.role !== "guest")
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
            <p className="muted">
              Alquiler actual de {target.name}: {euros(rent)}. Un cambio
              comienza en el mes elegido y conserva los anteriores.
            </p>
            <div className="form-stack">
              <label>
                Estado del alquiler del mes
                <input
                  type="month"
                  value={statusMonth}
                  onChange={(e) => setStatusMonth(e.target.value)}
                />
              </label>
              <p>
                {target.name} ·{" "}
                {euros(rentForMember(state, target.id, statusMonth))} ·{" "}
                {rentIsPaid(state, target.id, statusMonth)
                  ? settings.rentStatuses?.some(
                      (status) =>
                        status.memberId === target.id &&
                        status.month === statusMonth,
                    )
                    ? "Pagado"
                    : "Pagado automáticamente"
                  : "Pendiente"}
              </p>
              <Button
                type="button"
                variant="secondary"
                disabled={
                  pending || !rentForMember(state, target.id, statusMonth)
                }
                onClick={() =>
                  void save({
                    type: "finance.rent.status",
                    memberId: target.id,
                    month: statusMonth,
                    paid: !rentIsPaid(state, target.id, statusMonth),
                  })
                }
              >
                Marcar como{" "}
                {rentIsPaid(state, target.id, statusMonth)
                  ? "pendiente"
                  : "pagado"}
              </Button>
            </div>
            <form
              className="form-stack"
              key={`rent-${selected}`}
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                await save({
                  type: "finance.rent",
                  memberId: selected,
                  fromMonth: form.get("fromMonth"),
                  amount: form.get("amount"),
                });
              }}
            >
              <div className="form-grid">
                <label>
                  Desde el mes
                  <input
                    type="month"
                    name="fromMonth"
                    defaultValue={month}
                    min={month}
                    required
                  />
                </label>
                <label>
                  Alquiler mensual (€)
                  <input
                    name="amount"
                    inputMode="decimal"
                    defaultValue={(rent / 100).toFixed(2)}
                    required
                  />
                </label>
              </div>
              <Button type="submit" disabled={pending}>
                Guardar alquiler
              </Button>
            </form>
            <form
              className="form-stack"
              key={`deposit-${selected}`}
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                await save({
                  type: "finance.deposit",
                  memberId: selected,
                  amount: form.get("amount"),
                  paidAt: form.get("paidAt"),
                });
              }}
            >
              <div className="form-grid">
                <label>
                  Fianza entregada (€)
                  <input
                    name="amount"
                    inputMode="decimal"
                    defaultValue={((deposit?.amount ?? 0) / 100).toFixed(2)}
                    required
                  />
                </label>
                <label>
                  Fecha de entrega
                  <input
                    type="date"
                    name="paidAt"
                    defaultValue={deposit?.paidAt ?? `${month}-01`}
                    required
                  />
                </label>
              </div>
              <Button type="submit" disabled={pending}>
                Guardar fianza
              </Button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
