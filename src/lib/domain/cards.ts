import type { Community } from "./types";
import { balances } from "./money";

export function commonCard(state: Community, month: string) {
  const expenses = state.expenses.filter((e) => e.month === month);
  return {
    house: state.name,
    month,
    total: expenses.reduce((sum, e) => sum + e.amount, 0),
    count: expenses.length,
    categories: state.categories
      .map((c) => ({
        name: c.name,
        amount: expenses
          .filter((e) => e.categoryId === c.id)
          .reduce((sum, e) => sum + e.amount, 0),
      }))
      .filter((c) => c.amount > 0),
  };
}

export function personalCard(
  state: Community,
  memberId: string,
  month: string,
) {
  const member = state.members.find((m) => m.id === memberId);
  if (!member) throw new Error("El miembro no existe.");
  const balance = balances(state, month).find((b) => b.memberId === memberId)!;
  return {
    house: state.name,
    month,
    name: member.name,
    expenseShare: balance.share,
    billableShare: balance.billableShare,
    credited: balance.credited,
    commonContribution: Math.max(0, balance.sharedPending),
    included: state.finance?.expensesIncludedInRent ?? false,
  };
}
