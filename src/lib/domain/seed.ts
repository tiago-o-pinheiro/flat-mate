import type { Community } from "./types";
import { addDays, currentMonth, shiftMonth, today } from "./dates";
import { splitMoney } from "./money";
import { materializeRotations } from "./commands";
export function createCommunity(
  name: string,
  ownerKey: string,
  ownerName: string,
  now = new Date(),
): Community {
  const id = crypto.randomUUID(),
    admin = crypto.randomUUID(),
    month = currentMonth(now);
  return {
    id,
    name,
    address: "Un lugar al que llamar casa",
    ownerKey,
    createdAt: now.toISOString(),
    members: [
      {
        id: admin,
        name: ownerName,
        avatar: 0,
        role: "admin",
        active: true,
        joinedMonth: month,
        registered: true,
        accessVersion: 0,
      },
    ],
    categories: [
      {
        id: "electricity",
        name: "Luz",
        icon: "bolt",
        color: "#EAB65C",
        archived: false,
      },
      {
        id: "water",
        name: "Agua",
        icon: "water",
        color: "#77A6C3",
        archived: false,
      },
      {
        id: "gas",
        name: "Gas",
        icon: "flame",
        color: "#DB997C",
        archived: false,
      },
      {
        id: "internet",
        name: "Internet",
        icon: "wifi",
        color: "#A298C2",
        archived: false,
      },
      {
        id: "cleaning",
        name: "Limpieza",
        icon: "sparkles",
        color: "#89A896",
        archived: false,
      },
      {
        id: "other",
        name: "Otros",
        icon: "basket",
        color: "#B2A797",
        archived: false,
      },
    ],
    boards: [month],
    expenses: [],
    payments: [],
    reimbursements: [],
    paymentClaims: [],
    shareTokens: [],
    finance: {
      defaultSettlementMode: "reimburse",
      expensesIncludedInRent: false,
      rents: [],
      deposits: [],
      rentStatuses: [],
    },
    comments: [],
    announcements: [],
    events: [],
    rotations: [],
    audit: [],
    google: {},
    calendars: [
      { id: "house", name: "Casa", color: "#DD6E60", authorId: admin },
      { id: "chores", name: "Limpieza", color: "#729681", authorId: admin },
      { id: "away", name: "Ausencias", color: "#8E87B3", authorId: admin },
    ],
  };
}
export function demoCommunity(ownerKey: string, now = new Date()) {
  const state = createCommunity("Casa del Sol", ownerKey, "Tiago", now),
    month = currentMonth(now),
    admin = state.members[0].id;
  state.address = "Barcelona · Nuestro pequeño hogar";
  state.members[0].joinedMonth = shiftMonth(month, -11);
  for (const [i, name] of ["Ana", "Juan", "Lucía"].entries())
    state.members.push({
      id: crypto.randomUUID(),
      name,
      avatar: i + 1,
      role: "member",
      active: true,
      joinedMonth: shiftMonth(month, -11),
      registered: true,
      accessVersion: 0,
    });
  const members = state.members.map((m) => m.id);
  const add = (
    title: string,
    amount: number,
    categoryId: string,
    m: string,
    payer: number,
    day: number,
  ) =>
    state.expenses.push({
      id: crypto.randomUUID(),
      title,
      amount,
      categoryId,
      month: m,
      date: `${m}-${String(day).padStart(2, "0")}`,
      authorId: members[payer],
      payerId: members[payer],
      shares: splitMoney(amount, members),
      createdAt: new Date(
        `${m}-${String(day).padStart(2, "0")}T12:00:00Z`,
      ).toISOString(),
    });
  add("Factura de la luz", 8632, "electricity", month, 0, 3);
  add("Internet de casa", 3990, "internet", month, 0, 5);
  add("Factura del agua", 4820, "water", month, 2, 7);
  add("Productos de limpieza", 2460, "cleaning", month, 1, 10);
  add("Factura del gas", 5670, "gas", month, 0, 12);
  add("Compra para la casa", 1875, "other", month, 3, 14);
  for (let i = 1; i <= 11; i++) {
    const m = shiftMonth(month, -i);
    state.boards.push(m);
    for (const [j, cat] of state.categories.entries())
      add(
        cat.name,
        Math.round(
          (2300 + ((i * 1371 + j * 923) % 5700)) * (j === 4 ? 0.45 : 1),
        ),
        cat.id,
        m,
        0,
        j + 2,
      );
    for (const mid of members.slice(1)) {
      const due = state.expenses
        .filter((e) => e.month === m)
        .reduce(
          (n, e) => n + (e.shares.find((s) => s.memberId === mid)?.amount ?? 0),
          0,
        );
      state.payments.push({
        id: crypto.randomUUID(),
        memberId: mid,
        month: m,
        amount: due,
        direction: "to_admin",
        authorId: mid,
        createdAt: `${m}-28T12:00:00Z`,
      });
    }
  }
  state.payments.push({
    id: crypto.randomUUID(),
    memberId: members[1],
    month,
    amount: 2500,
    direction: "to_admin",
    authorId: members[1],
    createdAt: now.toISOString(),
  });
  state.announcements = [
    {
      id: crypto.randomUUID(),
      authorId: members[1],
      body: "He dejado lasaña en la nevera. ¡Servíos sin miedo! Hay también una versión vegetariana 🌱",
      pinned: false,
      createdAt: new Date(now.getTime() - 3600000).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      authorId: admin,
      body: "El sábado hacemos cena de piso. Cada uno trae algo y nos ponemos al día. ¿A las 21:00?",
      pinned: true,
      createdAt: new Date(now.getTime() - 86400000).toISOString(),
    },
  ];
  state.comments.push({
    id: crypto.randomUUID(),
    authorId: members[2],
    month,
    body: "Ya he añadido el agua de este mes. La factura venía un poquito más baja 🙌",
    createdAt: now.toISOString(),
  });
  state.rotations.push({
    id: crypto.randomUUID(),
    title: "Limpieza del baño",
    calendarId: "chores",
    start: addDays(today(now), 1),
    everyWeeks: 1,
    memberIds: members,
    authorId: admin,
    active: true,
  });
  materializeRotations(state, now);
  state.events.push(
    {
      id: crypto.randomUUID(),
      title: "Cena de piso",
      calendarId: "house",
      start: addDays(today(now), 2),
      end: addDays(today(now), 2),
      allDay: true,
      kind: "event",
      authorId: admin,
      completed: false,
      version: 1,
      syncedVersion: 0,
    },
    {
      id: crypto.randomUUID(),
      title: "Lucía está de viaje",
      calendarId: "away",
      start: addDays(today(now), 5),
      end: addDays(today(now), 10),
      allDay: true,
      kind: "absence",
      authorId: members[3],
      assigneeId: members[3],
      completed: false,
      version: 1,
      syncedVersion: 0,
    },
  );
  return state;
}
