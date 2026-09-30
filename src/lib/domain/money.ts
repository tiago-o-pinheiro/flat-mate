import { PublicError } from "./errors";
import type { Balance, Community } from "./types";
export function financeSettings(state: Pick<Community, "finance">) {
  return (
    state.finance ?? {
      defaultSettlementMode: "credit" as const,
      expensesIncludedInRent: false,
      rents: [],
      deposits: [],
    }
  );
}
export function rentForMember(
  state: Pick<Community, "finance">,
  memberId: string,
  month: string,
) {
  return (
    financeSettings(state)
      .rents.filter((r) => r.memberId === memberId && r.fromMonth <= month)
      .sort((a, b) => b.fromMonth.localeCompare(a.fromMonth))[0]?.amount ?? 0
  );
}
export function rentIsPaid(
  state: Pick<Community, "finance">,
  memberId: string,
  month: string,
) {
  return (
    financeSettings(state).rentStatuses?.find(
      (status) => status.memberId === memberId && status.month === month,
    )?.paid ?? true
  );
}
export function reimbursementDue(
  state: Pick<Community, "expenses" | "reimbursements">,
  expenseId: string,
) {
  const expense = state.expenses.find((e) => e.id === expenseId);
  if (!expense || (expense.settlementMode ?? "credit") !== "reimburse")
    return 0;
  return (
    expense.amount -
    (state.reimbursements ?? [])
      .filter((r) => r.expenseId === expenseId && !r.voidedAt)
      .reduce((sum, r) => sum + r.amount, 0)
  );
}
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
export function parseMoneyOrZero(value: string): number {
  if (/^0+([.,]0{1,2})?$/.test(value.trim())) return 0;
  return parseMoney(value);
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
  state: Pick<Community, "members" | "expenses" | "payments" | "finance">,
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
    const billableShare = expenses
      .filter((e) => e.chargeable !== false)
      .reduce(
        (n, e) =>
          n + (e.shares.find((s) => s.memberId === member.id)?.amount ?? 0),
        0,
      );
    const advanced = expenses
      .filter((e) => e.payerId === member.id)
      .reduce((n, e) => n + e.amount, 0);
    const credited = expenses
      .filter(
        (e) =>
          e.payerId === member.id &&
          (e.settlementMode ?? "credit") === "credit" &&
          e.chargeable !== false,
      )
      .reduce((n, e) => n + e.amount, 0);
    const rent = rentForMember(state, member.id, month);
    const rentPaid = rentIsPaid(state, member.id, month);
    const rentDue = rentPaid ? 0 : rent;
    const paid = payments
      .filter((p) => p.direction === "to_admin")
      .reduce((n, p) => n + p.amount, 0);
    const refunded = payments
      .filter((p) => p.direction === "from_admin")
      .reduce((n, p) => n + p.amount, 0);
    const sharedBase = billableShare - credited;
    const generalPaid = payments
      .filter(
        (p) =>
          (p.direction === "to_admin" && !p.purpose) ||
          (p.direction === "to_admin" && p.purpose === "general"),
      )
      .reduce((n, p) => n + p.amount, 0);
    const sharedPaid = payments
      .filter((p) => p.direction === "to_admin" && p.purpose === "shared")
      .reduce((n, p) => n + p.amount, 0);
    const rentPaymentAmount = payments
      .filter((p) => p.direction === "to_admin" && p.purpose === "rent")
      .reduce((n, p) => n + p.amount, 0);
    const sharedRefunded = payments
      .filter((p) => p.direction === "from_admin" && p.purpose !== "rent")
      .reduce((n, p) => n + p.amount, 0);
    const rentRefunded = payments
      .filter((p) => p.direction === "from_admin" && p.purpose === "rent")
      .reduce((n, p) => n + p.amount, 0);
    const sharedPending =
      sharedBase -
      sharedPaid -
      Math.min(Math.max(0, sharedBase - sharedPaid), generalPaid) +
      sharedRefunded;
    const generalForRent = Math.max(
      0,
      generalPaid - Math.max(0, sharedBase - sharedPaid),
    );
    const rentPending =
      rentDue - rentPaymentAmount - generalForRent + rentRefunded;
    return {
      memberId: member.id,
      share,
      billableShare,
      rent,
      rentPaid,
      advanced,
      credited,
      paid,
      refunded,
      pending: billableShare + rentDue - credited - paid + refunded,
      sharedPending,
      rentPending,
    };
  });
}
export const euros = (cents: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
