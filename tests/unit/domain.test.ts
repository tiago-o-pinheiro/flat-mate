import { describe, expect, it } from "vitest";
import {
  applyCommand,
  materializeRotations,
} from "../../src/lib/domain/commands";
import { createCommunity } from "../../src/lib/domain/seed";
import {
  balances,
  parseMoney,
  reimbursementDue,
  splitMoney,
} from "../../src/lib/domain/money";
import { currentMonth, monthEnd, shiftMonth } from "../../src/lib/domain/dates";
import {
  publicCommunity,
  requireMember,
} from "../../src/lib/domain/permissions";
import type { Actor } from "../../src/lib/domain/types";
import {
  bindGoogleInvite,
  consumePersonalShareToken,
} from "../../src/lib/domain/access";
const now = new Date("2026-09-18T12:00:00Z");
function fixture() {
  const state = createCommunity("Piso", "google:owner", "Pedro", now);
  state.members[0].id = "pedro";
  for (const name of ["juan", "ana"])
    state.members.push({
      id: name,
      name,
      role: "member",
      active: true,
      joinedMonth: "2026-01",
      registered: true,
      avatar: 1,
      accessVersion: 0,
    });
  state.members[0].joinedMonth = "2026-01";
  return {
    state,
    admin: {
      communityId: state.id,
      memberId: "pedro",
      accessVersion: 0,
    } satisfies Actor,
    juan: {
      communityId: state.id,
      memberId: "juan",
      accessVersion: 0,
    } satisfies Actor,
  };
}
const expense = {
  type: "expense.save",
  title: "Luz",
  amount: "90",
  categoryId: "electricity",
  month: "2026-09",
  date: "2026-09-10",
  payerId: "juan",
  memberIds: ["juan", "pedro", "ana"],
};
describe("dinero y reparto", () => {
  it.each([
    ["25,30", 2530],
    ["25.3", 2530],
    ["0.01", 1],
    ["100", 10000],
  ])("convierte %s a céntimos exactos", (value, expected) =>
    expect(parseMoney(value)).toBe(expected),
  );
  it.each(["0", "-2", "1.005", "NaN", "1e3", "1,000.00", "9999999999"])(
    "rechaza importes ambiguos o inválidos: %s",
    (value) => expect(() => parseMoney(value)).toThrow(),
  );
  it("reparte el último céntimo de forma estable y conserva el total", () => {
    expect(splitMoney(100, ["c", "b", "a"])).toEqual([
      { memberId: "a", amount: 34 },
      { memberId: "b", amount: 33 },
      { memberId: "c", amount: 33 },
    ]);
    for (let amount = 1; amount < 500; amount++)
      expect(
        splitMoney(amount, ["a", "b", "c"]).reduce((n, s) => n + s.amount, 0),
      ).toBe(amount);
  });
  it("rechaza divisiones vacías y duplicadas", () => {
    expect(() => splitMoney(100, [])).toThrow();
    expect(() => splitMoney(100, ["a", "a"])).toThrow();
  });
  it("Juan adelanta 90 €, le corresponden 30 € y recibe 60 €", () => {
    const { state, admin } = fixture();
    applyCommand(
      state,
      admin,
      {
        type: "finance.settings",
        defaultSettlementMode: "credit",
        expensesIncludedInRent: false,
      },
      now,
    );
    applyCommand(state, admin, expense, now);
    expect(
      balances(state, "2026-09").find((b) => b.memberId === "juan"),
    ).toMatchObject({ share: 3000, advanced: 9000, pending: -6000 });
  });
  it("reembolsa el recibo completo y conserva cuotas iguales", () => {
    const { state, admin } = fixture();
    applyCommand(
      state,
      admin,
      {
        type: "finance.settings",
        defaultSettlementMode: "reimburse",
        expensesIncludedInRent: false,
      },
      now,
    );
    const expenseId = applyCommand(state, admin, expense, now);
    const rows = balances(state, "2026-09");
    expect(rows.map((row) => row.share)).toEqual([3000, 3000, 3000]);
    expect(rows.find((row) => row.memberId === "juan")).toMatchObject({
      advanced: 9000,
      credited: 0,
      pending: 3000,
    });
    expect(reimbursementDue(state, expenseId)).toBe(9000);
    applyCommand(
      state,
      admin,
      { type: "reimbursement.add", expenseId, amount: "90" },
      now,
    );
    expect(reimbursementDue(state, expenseId)).toBe(0);
    expect(
      balances(state, "2026-09").find((row) => row.memberId === "juan")
        ?.pending,
    ).toBe(3000);
  });
  it("cambiar la dinámica corrige también los recibos anteriores", () => {
    const { state, admin } = fixture();
    applyCommand(
      state,
      admin,
      {
        type: "finance.settings",
        defaultSettlementMode: "credit",
        expensesIncludedInRent: false,
      },
      now,
    );
    const expenseId = applyCommand(state, admin, expense, now);
    expect(
      balances(state, "2026-09").find((row) => row.memberId === "juan")
        ?.pending,
    ).toBe(-6000);
    applyCommand(
      state,
      admin,
      {
        type: "finance.settings",
        defaultSettlementMode: "reimburse",
        expensesIncludedInRent: false,
      },
      now,
    );
    expect(state.expenses[0].settlementMode).toBe("reimburse");
    expect(
      balances(state, "2026-09").find((row) => row.memberId === "juan")
        ?.pending,
    ).toBe(3000);
    expect(reimbursementDue(state, expenseId)).toBe(9000);
    applyCommand(
      state,
      admin,
      { type: "reimbursement.add", expenseId, amount: "90" },
      now,
    );
    expect(() =>
      applyCommand(
        state,
        admin,
        {
          type: "finance.settings",
          defaultSettlementMode: "credit",
          expensesIncludedInRent: false,
        },
        now,
      ),
    ).toThrow("Anula primero los reembolsos");
  });
  it("separa alquiler y fianza privados de gastos incluidos", () => {
    const { state, admin } = fixture();
    applyCommand(
      state,
      admin,
      {
        type: "finance.settings",
        defaultSettlementMode: "reimburse",
        expensesIncludedInRent: true,
      },
      now,
    );
    applyCommand(
      state,
      admin,
      {
        type: "finance.rent",
        memberId: "juan",
        fromMonth: "2026-09",
        amount: "380",
      },
      now,
    );
    applyCommand(
      state,
      admin,
      {
        type: "finance.rent",
        memberId: "ana",
        fromMonth: "2026-09",
        amount: "450",
      },
      now,
    );
    applyCommand(
      state,
      admin,
      {
        type: "finance.deposit",
        memberId: "juan",
        amount: "700",
        paidAt: "2026-01-10",
      },
      now,
    );
    applyCommand(state, admin, expense, now);
    const rows = balances(state, "2026-09");
    expect(rows.find((row) => row.memberId === "juan")).toMatchObject({
      share: 3000,
      billableShare: 0,
      rent: 38000,
      rentPaid: true,
      pending: 0,
    });
    expect(rows.find((row) => row.memberId === "ana")?.pending).toBe(0);
    applyCommand(
      state,
      admin,
      {
        type: "finance.rent.status",
        memberId: "juan",
        month: "2026-09",
        paid: false,
      },
      now,
    );
    expect(
      balances(state, "2026-09").find((row) => row.memberId === "juan"),
    ).toMatchObject({ rentPaid: false, pending: 38000 });
    const visible = JSON.stringify(publicCommunity(state, "juan"));
    expect(visible).toContain("38000");
    expect(visible).toContain("70000");
    expect(visible).not.toContain("45000");
  });
  it("compensa pagos, devoluciones y correcciones sin borrar movimientos", () => {
    const { state, admin } = fixture();
    applyCommand(
      state,
      admin,
      {
        type: "finance.settings",
        defaultSettlementMode: "credit",
        expensesIncludedInRent: false,
      },
      now,
    );
    const id = applyCommand(state, admin, expense, now);
    applyCommand(
      state,
      admin,
      {
        type: "payment.add",
        memberId: "juan",
        month: "2026-09",
        amount: "40",
        direction: "from_admin",
      },
      now,
    );
    expect(
      balances(state, "2026-09").find((b) => b.memberId === "juan")?.pending,
    ).toBe(-2000);
    applyCommand(state, admin, { ...expense, id, amount: "60" }, now);
    expect(
      balances(state, "2026-09").find((b) => b.memberId === "juan")?.pending,
    ).toBe(0);
    applyCommand(
      state,
      admin,
      { type: "payment.void", id: state.payments[0].id },
      now,
    );
    expect(state.payments).toHaveLength(1);
    expect(state.payments[0].voidedBy).toBe("pedro");
    expect(
      balances(state, "2026-09").find((b) => b.memberId === "juan")?.pending,
    ).toBe(-4000);
  });
  it("un visitante participa solo en su mes y no cambia gastos existentes", () => {
    const { state, admin } = fixture();
    applyCommand(state, admin, expense, now);
    const guestId = applyCommand(
      state,
      admin,
      { type: "member.guest", name: "Visita", month: "2026-09" },
      now,
    );
    expect(state.expenses[0].shares).toHaveLength(3);
    applyCommand(
      state,
      admin,
      { ...expense, title: "Solo visita", memberIds: [guestId] },
      now,
    );
    expect(state.expenses[1].shares).toEqual([
      { memberId: guestId, amount: 9000 },
    ]);
    expect(() =>
      applyCommand(
        state,
        admin,
        { ...expense, month: "2026-10", memberIds: [guestId] },
        now,
      ),
    ).toThrow();
  });
});
describe("permisos y privacidad", () => {
  it("vincula Google solo con la primera invitación y consume los enlaces individuales", () => {
    const { state } = fixture();
    state.members[1].inviteHash = "invitacion";
    expect(
      bindGoogleInvite(state, "invitacion", "google-juan", "juan@example.com"),
    ).toMatchObject({ id: "juan" });
    expect(() =>
      bindGoogleInvite(state, "invitacion", "otro-google"),
    ).toThrow();
    state.members[2].inviteHash = "otra-invitacion";
    expect(() =>
      bindGoogleInvite(state, "otra-invitacion", "google-juan"),
    ).toThrow();
    state.shareTokens = [
      {
        id: "card",
        hash: "tarjeta",
        memberId: "juan",
        month: "2026-09",
        createdAt: now.toISOString(),
      },
    ];
    expect(() =>
      consumePersonalShareToken(state, "tarjeta", "ana", now),
    ).toThrow();
    expect(consumePersonalShareToken(state, "tarjeta", "juan", now)).toBe(
      "2026-09",
    );
    expect(() =>
      consumePersonalShareToken(state, "tarjeta", "juan", now),
    ).toThrow();
  });
  it("aísla comunidades aunque se conozcan IDs", () => {
    const { state, admin } = fixture();
    expect(() =>
      applyCommand(state, { ...admin, communityId: "otra-casa" }, expense, now),
    ).toThrow();
  });
  it("revocar un enlace invalida la sesión anterior", () => {
    const { state, admin, juan } = fixture();
    state.members[1].inviteHash = "secreto";
    applyCommand(state, admin, { type: "member.revoke", id: "juan" }, now);
    expect(() => requireMember(state, juan)).toThrow();
    expect(state.members[1].inviteHash).toBeUndefined();
  });
  it("un miembro no modifica gastos de otros ni meses pasados", () => {
    const { state, admin, juan } = fixture();
    const id = applyCommand(state, admin, expense, now);
    expect(() =>
      applyCommand(state, juan, { type: "expense.delete", id }, now),
    ).toThrow();
    expect(() =>
      applyCommand(state, juan, { ...expense, month: "2026-08" }, now),
    ).toThrow();
    const own = applyCommand(state, juan, expense, now);
    applyCommand(state, juan, { type: "expense.delete", id: own }, now);
    expect(state.expenses).toHaveLength(1);
  });
  it("solo el admin valida los pagos declarados y anula movimientos", () => {
    const { state, admin, juan } = fixture();
    applyCommand(state, admin, { ...expense, payerId: "pedro" }, now);
    expect(() =>
      applyCommand(
        state,
        juan,
        {
          type: "payment.add",
          memberId: "ana",
          month: "2026-09",
          amount: "5",
          direction: "to_admin",
        },
        now,
      ),
    ).toThrow();
    expect(() =>
      applyCommand(
        state,
        juan,
        {
          type: "payment.add",
          memberId: "juan",
          month: "2026-09",
          amount: "5",
          direction: "from_admin",
        },
        now,
      ),
    ).toThrow();
    const claimId = applyCommand(
      state,
      juan,
      {
        type: "payment.claim",
        month: "2026-09",
        amount: "5",
        purpose: "shared",
      },
      now,
    );
    expect(state.payments).toHaveLength(0);
    expect(() =>
      applyCommand(
        state,
        juan,
        { type: "payment.claim.resolve", id: claimId, approved: true },
        now,
      ),
    ).toThrow();
    applyCommand(
      state,
      admin,
      { type: "payment.claim.resolve", id: claimId, approved: true },
      now,
    );
    expect(state.payments).toHaveLength(1);
    expect(() =>
      applyCommand(
        state,
        admin,
        { type: "payment.claim.resolve", id: claimId, approved: true },
        now,
      ),
    ).toThrow();
    expect(() =>
      applyCommand(
        state,
        juan,
        { type: "payment.void", id: state.payments[0].id },
        now,
      ),
    ).toThrow();
  });
  it("evita validar dos veces una transferencia y rechaza declaraciones de alquiler", () => {
    const { state, admin, juan } = fixture();
    applyCommand(state, admin, { ...expense, payerId: "pedro" }, now);
    expect(() =>
      applyCommand(
        state,
        juan,
        {
          type: "payment.claim",
          month: "2026-09",
          amount: "10",
          purpose: "rent",
        },
        now,
      ),
    ).toThrow();
    const claimId = applyCommand(
      state,
      juan,
      {
        type: "payment.claim",
        month: "2026-09",
        amount: "30",
        purpose: "shared",
      },
      now,
    );
    applyCommand(
      state,
      admin,
      {
        type: "payment.add",
        memberId: "juan",
        month: "2026-09",
        amount: "30",
        direction: "to_admin",
        purpose: "shared",
      },
      now,
    );
    expect(() =>
      applyCommand(
        state,
        admin,
        { type: "payment.claim.resolve", id: claimId, approved: true },
        now,
      ),
    ).toThrow();
    expect(state.payments).toHaveLength(1);
    expect(state.paymentClaims?.[0].status).toBe("pending");
  });
  it("el admin no se paga a sí mismo", () => {
    const { state, admin } = fixture();
    expect(() =>
      applyCommand(
        state,
        admin,
        {
          type: "payment.add",
          memberId: "pedro",
          month: "2026-09",
          amount: "5",
          direction: "to_admin",
        },
        now,
      ),
    ).toThrow();
  });
  it("desactivar un miembro preserva su histórico", () => {
    const { state, admin, juan } = fixture();
    applyCommand(state, admin, expense, now);
    applyCommand(state, admin, { type: "member.deactivate", id: "juan" }, now);
    expect(() => requireMember(state, juan)).toThrow();
    expect(
      balances(state, "2026-09").find((b) => b.memberId === "juan")?.pending,
    ).toBe(3000);
  });
  it("una factura tardía puede incluir a quien vivía en el piso en ese mes", () => {
    const { state, admin } = fixture();
    applyCommand(state, admin, { type: "member.deactivate", id: "juan" }, now);
    applyCommand(state, admin, { ...expense, month: "2026-08" }, now);
    expect(state.expenses[0].shares.some((s) => s.memberId === "juan")).toBe(
      true,
    );
    expect(() => applyCommand(state, admin, expense, now)).toThrow();
  });
  it("los secretos nunca se serializan al cliente", () => {
    const { state } = fixture();
    state.members[1].inviteHash = "HASH_SUPER_SECRET";
    state.google.encryptedToken = "TOKEN_SUPER_SECRET";
    state.members[1].googleSub = "GOOGLE_SUB_SECRET";
    state.members[2].googleEmail = "ana-private@example.com";
    state.shareTokens = [
      {
        id: "card",
        hash: "CARD_HASH_SECRET",
        memberId: "juan",
        month: "2026-09",
        createdAt: now.toISOString(),
      },
    ];
    const data = JSON.stringify(publicCommunity(state, "juan"));
    expect(data).not.toContain("SUPER_SECRET");
    expect(data).not.toContain("GOOGLE_SUB_SECRET");
    expect(data).not.toContain("CARD_HASH_SECRET");
    expect(data).not.toContain("ana-private@example.com");
    expect(data).not.toContain("ownerKey");
  });
  it("un miembro no administra categorías, invitados ni anuncios ajenos", () => {
    const { state, admin, juan } = fixture();
    const id = applyCommand(
      state,
      admin,
      { type: "announcement.save", body: "Hola" },
      now,
    );
    expect(() =>
      applyCommand(state, juan, { type: "announcement.delete", id }, now),
    ).toThrow();
    expect(() =>
      applyCommand(state, juan, { type: "category.archive", id: "water" }, now),
    ).toThrow();
    expect(() =>
      applyCommand(
        state,
        juan,
        { type: "member.guest", name: "X", month: "2026-09" },
        now,
      ),
    ).toThrow();
  });
});
describe("fechas y turnos", () => {
  it("usa el mes de Madrid, también cerca de medianoche", () => {
    expect(currentMonth(new Date("2026-09-30T22:30:00Z"))).toBe("2026-10");
    expect(currentMonth(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01");
  });
  it("calcula febrero, años bisiestos y cambios de año", () => {
    expect(monthEnd("2028-02")).toBe("2028-02-29");
    expect(monthEnd("2026-02")).toBe("2026-02-28");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
  it("no traslada ni borra deudas al cambiar de mes", () => {
    const { state, admin } = fixture();
    applyCommand(state, admin, expense, now);
    state.boards.push("2026-10");
    expect(balances(state, "2026-10").every((b) => b.pending === 0)).toBe(true);
    expect(
      balances(state, "2026-09").find((b) => b.memberId === "juan")?.pending,
    ).toBe(3000);
  });
  it("genera turnos sin duplicados y rota cada semana durante el cambio horario", () => {
    const { state, admin } = fixture();
    applyCommand(
      state,
      admin,
      {
        type: "rotation.save",
        title: "Baño",
        calendarId: "chores",
        start: "2026-10-18",
        everyWeeks: 1,
        memberIds: ["juan", "ana", "pedro"],
      },
      now,
    );
    const count = state.events.length;
    materializeRotations(state, now);
    expect(state.events).toHaveLength(count);
    expect(
      state.events.slice(0, 3).map((e) => [e.start, e.assigneeId]),
    ).toEqual([
      ["2026-10-18", "juan"],
      ["2026-10-25", "ana"],
      ["2026-11-01", "pedro"],
    ]);
  });
  it("editar una rotación conserva tareas completadas y crea solo turnos futuros nuevos", () => {
    const { state, admin } = fixture();
    const id = applyCommand(
      state,
      admin,
      {
        type: "rotation.save",
        title: "Baño",
        calendarId: "chores",
        start: "2026-09-18",
        everyWeeks: 1,
        memberIds: ["juan", "ana"],
      },
      now,
    );
    state.events[0].completed = true;
    const completedId = state.events[0].id;
    applyCommand(
      state,
      admin,
      {
        type: "rotation.save",
        id,
        title: "Nuevo baño",
        calendarId: "chores",
        start: "2026-09-25",
        everyWeeks: 2,
        memberIds: ["ana", "juan"],
      },
      now,
    );
    expect(state.events.find((e) => e.id === completedId)).toMatchObject({
      completed: true,
      title: "Baño",
    });
    expect(
      state.events
        .filter((e) => e.rotationId === id && !e.completed)
        .every((e) => e.deleted),
    ).toBe(true);
  });
  it("una ausencia no altera el reparto y solo el responsable completa su turno", () => {
    const { state, admin, juan } = fixture();
    applyCommand(state, admin, expense, now);
    const before = balances(state, "2026-09");
    applyCommand(
      state,
      juan,
      {
        type: "event.save",
        title: "Viaje",
        calendarId: "away",
        start: "2026-09-20",
        end: "2026-09-24",
        allDay: true,
        kind: "absence",
      },
      now,
    );
    expect(balances(state, "2026-09")).toEqual(before);
    const id = applyCommand(
      state,
      admin,
      {
        type: "event.save",
        title: "Baño",
        calendarId: "chores",
        start: "2026-09-20",
        end: "2026-09-20",
        allDay: true,
        kind: "chore",
        assigneeId: "ana",
      },
      now,
    );
    expect(() =>
      applyCommand(state, juan, { type: "event.complete", id }, now),
    ).toThrow();
  });
});
