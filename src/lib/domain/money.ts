import { PublicError } from "./errors";
import type { Balance, Community } from "./types";
export function parseMoney(value: string): number {
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(value.trim()))
    throw new PublicError(
      "Introduce un importe válido, con un máximo de dos decimales.",
    );
  const [whole, decimal = ""] = value.trim().replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (cents <= 0) throw new PublicError("El importe debe ser mayor que cero.");
  return cents;
}
export function splitMoney(amount: number, memberIds: string[]) {
  const ids = [...new Set(memberIds)].sort();
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !ids.length ||
    ids.length !== memberIds.length
  )
    throw new PublicError("Elige participantes distintos y un importe válido.");
  const base = Math.floor(amount / ids.length),
    remainder = amount % ids.length;
  return ids.map((memberId, i) => ({
    memberId,
    amount: base + (i < remainder ? 1 : 0),
  }));
}
export function balances(
  state: Pick<Community, "members" | "expenses" | "payments">,
  month: string,
): Balance[] {
  return state.members.map((member) => {
    const expenses = state.expenses.filter((e) => e.month === month);
    const payments = state.payments.filter(
      (p) => p.month === month && p.memberId === member.id && !p.voidedAt,
    );
    const share = expenses.reduce(
      (n, e) =>
        n + (e.shares.find((s) => s.memberId === member.id)?.amount ?? 0),
      0,
    );
    const advanced = expenses
      .filter((e) => e.payerId === member.id)
      .reduce((n, e) => n + e.amount, 0);
    const paid = payments
      .filter((p) => p.direction === "to_admin")
      .reduce((n, p) => n + p.amount, 0);
    const refunded = payments
      .filter((p) => p.direction === "from_admin")
      .reduce((n, p) => n + p.amount, 0);
    return {
      memberId: member.id,
      share,
      advanced,
      paid,
      refunded,
      pending: share - advanced - paid + refunded,
    };
  });
}
export const euros = (cents: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
