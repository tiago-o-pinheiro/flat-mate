import { PublicError } from "./errors";
import type { Actor, Community, Member } from "./types";
import { currentMonth } from "./dates";
export function requireMember(state: Community, actor: Actor): Member {
  const member = state.members.find((m) => m.id === actor.memberId);
  if (
    state.id !== actor.communityId ||
    !member ||
    !member.active ||
    member.role === "guest" ||
    member.accessVersion !== actor.accessVersion
  )
    throw new PublicError(
      "Tu acceso ha caducado. Pide un nuevo enlace al administrador.",
    );
  return member;
}
export function requireAdmin(member: Member) {
  if (member.role !== "admin")
    throw new PublicError("Solo el administrador puede hacer esto.");
}
export function requireOwner(member: Member, authorId: string) {
  if (member.role !== "admin" && member.id !== authorId)
    throw new PublicError("Solo puedes modificar tus propias publicaciones.");
}
export function requireExpenseEdit(
  member: Member,
  authorId: string,
  month: string,
  now = new Date(),
) {
  requireOwner(member, authorId);
  if (member.role !== "admin" && month !== currentMonth(now))
    throw new PublicError("Solo el administrador puede corregir otros meses.");
}
export function publicCommunity(state: Community, viewerId: string) {
  const {
    ownerKey: _owner,
    google,
    members,
    shareTokens: _shareTokens,
    ...rest
  } = state;
  const { encryptedToken: _token, leaseUntil: _lease, ...safeGoogle } = google;
  const admin = members.find((m) => m.id === viewerId)?.role === "admin";
  const visible = (memberId: string) => admin || memberId === viewerId;
  const finance = state.finance && {
    ...state.finance,
    rents: state.finance.rents.filter((r) => visible(r.memberId)),
    deposits: state.finance.deposits.filter((d) => visible(d.memberId)),
    rentStatuses: state.finance.rentStatuses?.filter((status) =>
      visible(status.memberId),
    ),
  };
  return {
    ...rest,
    finance,
    payments: state.payments.filter((p) => visible(p.memberId)),
    paymentClaims: state.paymentClaims?.filter((c) => visible(c.memberId)),
    reimbursements: state.reimbursements?.filter((r) =>
      visible(state.expenses.find((e) => e.id === r.expenseId)?.payerId ?? ""),
    ),
    members: members.map(
      ({
        inviteHash: _hash,
        googleSub: _sub,
        googleEmail: _email,
        ...member
      }) => ({
        ...member,
        googleLinked: !!_sub,
        ...(visible(member.id) && _email ? { googleEmail: _email } : {}),
      }),
    ),
    google: { ...safeGoogle, connected: !!google.encryptedToken },
  };
}
