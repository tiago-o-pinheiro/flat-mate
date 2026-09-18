import { PublicError } from "./errors";
import { z } from "zod";
import { addDays, currentMonth, today } from "./dates";
import {
  requireAdmin,
  requireExpenseEdit,
  requireMember,
  requireOwner,
} from "./permissions";
import { parseMoney, splitMoney } from "./money";
import type { Actor, Community } from "./types";
const id = z.string().min(1).max(100),
  text = z.string().trim().min(1).max(120);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const date = z.iso.date();
const eventTime = z.union([date, z.iso.datetime({ offset: true })]);
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/);
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("expense.save"),
    id: id.optional(),
    title: text,
    amount: z.string(),
    categoryId: id,
    month,
    date,
    payerId: id,
    memberIds: z.array(id).min(1).max(50),
  }),
  z.object({ type: z.literal("expense.delete"), id }),
  z.object({
    type: z.literal("payment.add"),
    memberId: id,
    month,
    amount: z.string(),
    direction: z.enum(["to_admin", "from_admin"]),
  }),
  z.object({ type: z.literal("payment.void"), id }),
  z.object({
    type: z.literal("comment.add"),
    month,
    body: z.string().trim().min(1).max(2000),
  }),
  z.object({ type: z.literal("comment.delete"), id }),
  z.object({
    type: z.literal("announcement.save"),
    id: id.optional(),
    body: z.string().trim().min(1).max(4000),
  }),
  z.object({ type: z.literal("announcement.delete"), id }),
  z.object({ type: z.literal("announcement.pin"), id }),
  z.object({
    type: z.literal("category.save"),
    id: id.optional(),
    name: text,
    color,
    icon: z.enum([
      "bolt",
      "water",
      "flame",
      "wifi",
      "sparkles",
      "basket",
      "other",
    ]),
  }),
  z.object({ type: z.literal("category.archive"), id }),
  z.object({ type: z.literal("member.guest"), name: text, month }),
  z.object({ type: z.literal("member.deactivate"), id }),
  z.object({ type: z.literal("member.revoke"), id }),
  z.object({
    type: z.literal("profile.save"),
    name: text,
    avatar: z.number().int().min(0).max(7),
  }),
  z.object({
    type: z.literal("community.save"),
    name: text,
    address: z.string().trim().max(150),
  }),
  z.object({
    type: z.literal("calendar.save"),
    id: id.optional(),
    name: text,
    color,
  }),
  z.object({
    type: z.literal("event.save"),
    id: id.optional(),
    title: text,
    calendarId: id,
    start: eventTime,
    end: eventTime,
    allDay: z.boolean(),
    kind: z.enum(["event", "absence", "chore"]),
    assigneeId: id.optional(),
  }),
  z.object({ type: z.literal("event.delete"), id }),
  z.object({ type: z.literal("event.complete"), id }),
  z.object({
    type: z.literal("rotation.save"),
    id: id.optional(),
    title: text,
    calendarId: id,
    start: date,
    everyWeeks: z.number().int().min(1).max(12),
    memberIds: z.array(id).min(1).max(50),
  }),
  z.object({ type: z.literal("rotation.delete"), id }),
]);
export type Command = z.infer<typeof commandSchema>;
export function eligible(
  state: Pick<Community, "members">,
  memberId: string,
  month: string,
  now = new Date(),
) {
  return state.members.some(
    (m) =>
      m.id === memberId &&
      (m.active ||
        (month < currentMonth(now) && !!m.leftMonth && month <= m.leftMonth)) &&
      (m.role === "guest" ? m.guestMonth === month : m.joinedMonth <= month),
  );
}
function get<T extends { id: string }>(list: T[], id: string) {
  const found = list.find((x) => x.id === id);
  if (!found) throw new PublicError("Este elemento ya no existe.");
  return found;
}
export function materializeRotations(state: Community, now = new Date()) {
  const start = today(now),
    horizon = addDays(start, 90);
  for (const rotation of state.rotations.filter((r) => r.active)) {
    const step = rotation.everyWeeks * 7;
    const elapsed = Math.floor(
      (Date.parse(`${start}T12:00:00Z`) -
        Date.parse(`${rotation.start}T12:00:00Z`)) /
        86400000,
    );
    const first = Math.max(0, Math.ceil(elapsed / step));
    for (let i = first; ; i++) {
      const day = addDays(rotation.start, i * step);
      if (day > horizon) break;
      const eventId = `${rotation.id}_${i}`;
      if (state.events.some((e) => e.id === eventId)) continue;
      const assigneeId = rotation.memberIds[i % rotation.memberIds.length];
      state.events.push({
        id: eventId,
        rotationId: rotation.id,
        occurrence: i,
        calendarId: rotation.calendarId,
        title: rotation.title,
        start: day,
        end: day,
        allDay: true,
        kind: "chore",
        authorId: rotation.authorId,
        assigneeId,
        completed: false,
        version: 1,
        syncedVersion: 0,
      });
    }
  }
}
export function applyCommand(
  state: Community,
  actor: Actor,
  input: unknown,
  now = new Date(),
) {
  const c = commandSchema.parse(input),
    member = requireMember(state, actor),
    timestamp = now.toISOString();
  let entityId = "id" in c && c.id ? c.id : crypto.randomUUID();
  let affectedMonth: string | undefined;
  switch (c.type) {
    case "expense.save": {
      const existing = c.id ? get(state.expenses, c.id) : undefined;
      requireExpenseEdit(
        member,
        existing?.authorId ?? member.id,
        existing?.month ?? c.month,
        now,
      );
      requireExpenseEdit(member, existing?.authorId ?? member.id, c.month, now);
      const category = get(state.categories, c.categoryId);
      if (category.archived && existing?.categoryId !== category.id)
        throw new PublicError("Esta categoría está archivada.");
      for (const selected of [...c.memberIds, c.payerId]) {
        const historicallyIncluded =
          existing?.shares.some((s) => s.memberId === selected) ||
          existing?.payerId === selected;
        if (
          !eligible(state, selected, c.month, now) &&
          !(historicallyIncluded && existing?.month === c.month)
        )
          throw new PublicError(
            "Hay participantes que no están disponibles en este mes.",
          );
      }
      const amount = parseMoney(c.amount);
      const expense = {
        id: entityId,
        title: c.title,
        amount,
        categoryId: c.categoryId,
        month: c.month,
        date: c.date,
        authorId: existing?.authorId ?? member.id,
        payerId: c.payerId,
        shares: splitMoney(amount, c.memberIds),
        createdAt: existing?.createdAt ?? timestamp,
        ...(existing ? { updatedAt: timestamp } : {}),
      };
      state.expenses = [
        ...state.expenses.filter((e) => e.id !== entityId),
        expense,
      ];
      affectedMonth = c.month;
      if (!state.boards.includes(c.month)) state.boards.push(c.month);
      break;
    }
    case "expense.delete": {
      const expense = get(state.expenses, c.id);
      requireExpenseEdit(member, expense.authorId, expense.month, now);
      affectedMonth = expense.month;
      state.expenses = state.expenses.filter((e) => e.id !== c.id);
      break;
    }
    case "payment.add": {
      const target = get(state.members, c.memberId);
      if (target.role === "admin")
        throw new PublicError("El administrador no se paga a sí mismo.");
      if (
        member.role !== "admin" &&
        (c.memberId !== member.id || c.direction !== "to_admin")
      )
        throw new PublicError(
          "Solo puedes registrar tus pagos al administrador.",
        );
      if (!state.boards.includes(c.month))
        throw new PublicError("No existe ese tablero mensual.");
      state.payments.push({
        id: entityId,
        memberId: c.memberId,
        month: c.month,
        amount: parseMoney(c.amount),
        direction: c.direction,
        authorId: member.id,
        createdAt: timestamp,
      });
      affectedMonth = c.month;
      break;
    }
    case "payment.void": {
      requireAdmin(member);
      const payment = get(state.payments, c.id);
      if (payment.voidedAt)
        throw new PublicError("El movimiento ya está anulado.");
      payment.voidedAt = timestamp;
      payment.voidedBy = member.id;
      affectedMonth = payment.month;
      break;
    }
    case "comment.add":
      if (!state.boards.includes(c.month))
        throw new PublicError("No existe ese tablero mensual.");
      state.comments.push({
        id: entityId,
        month: c.month,
        body: c.body,
        authorId: member.id,
        createdAt: timestamp,
      });
      affectedMonth = c.month;
      break;
    case "comment.delete": {
      const comment = get(state.comments, c.id);
      requireOwner(member, comment.authorId);
      state.comments = state.comments.filter((x) => x.id !== c.id);
      break;
    }
    case "announcement.save": {
      const old = c.id ? get(state.announcements, c.id) : undefined;
      if (old) requireOwner(member, old.authorId);
      state.announcements = [
        ...state.announcements.filter((a) => a.id !== c.id),
        {
          id: entityId,
          authorId: old?.authorId ?? member.id,
          body: c.body,
          pinned: old?.pinned ?? false,
          createdAt: old?.createdAt ?? timestamp,
          ...(old ? { updatedAt: timestamp } : {}),
        },
      ];
      break;
    }
    case "announcement.delete": {
      requireOwner(member, get(state.announcements, c.id).authorId);
      state.announcements = state.announcements.filter((a) => a.id !== c.id);
      break;
    }
    case "announcement.pin": {
      requireAdmin(member);
      const item = get(state.announcements, c.id);
      item.pinned = !item.pinned;
      break;
    }
    case "category.save": {
      requireAdmin(member);
      const old = c.id ? get(state.categories, c.id) : undefined;
      state.categories = [
        ...state.categories.filter((cat) => cat.id !== c.id),
        {
          id: entityId,
          name: c.name,
          color: c.color,
          icon: c.icon,
          archived: old?.archived ?? false,
        },
      ];
      break;
    }
    case "category.archive": {
      requireAdmin(member);
      const category = get(state.categories, c.id);
      category.archived = !category.archived;
      break;
    }
    case "member.guest": {
      requireAdmin(member);
      state.members.push({
        id: entityId,
        name: c.name,
        avatar: 6,
        role: "guest",
        active: true,
        joinedMonth: c.month,
        guestMonth: c.month,
        registered: true,
        accessVersion: 0,
      });
      break;
    }
    case "member.deactivate":
    case "member.revoke": {
      requireAdmin(member);
      const target = get(state.members, c.id);
      if (target.role === "admin")
        throw new PublicError("No puedes desactivar al administrador.");
      target.accessVersion++;
      delete target.inviteHash;
      if (c.type === "member.deactivate") {
        target.active = false;
        target.leftMonth = currentMonth(now);
        for (const rotation of state.rotations.filter(
          (r) => r.active && r.memberIds.includes(target.id),
        )) {
          rotation.memberIds = rotation.memberIds.filter(
            (mid) => mid !== target.id,
          );
          if (!rotation.memberIds.length) rotation.active = false;
          for (const e of state.events.filter(
            (e) =>
              e.rotationId === rotation.id &&
              !e.completed &&
              !e.deleted &&
              e.start.slice(0, 10) >= today(now),
          )) {
            if (!rotation.active) e.deleted = true;
            else
              e.assigneeId =
                rotation.memberIds[
                  (e.occurrence ?? 0) % rotation.memberIds.length
                ];
            e.version++;
          }
        }
      }
      break;
    }
    case "profile.save":
      member.name = c.name;
      member.avatar = c.avatar;
      member.registered = true;
      entityId = member.id;
      for (const event of state.events.filter(
        (e) => e.assigneeId === member.id && !e.deleted,
      ))
        event.version++;
      break;
    case "community.save":
      requireAdmin(member);
      state.name = c.name;
      state.address = c.address;
      for (const event of state.events.filter((e) => !e.deleted))
        event.version++;
      break;
    case "calendar.save": {
      const old = c.id ? get(state.calendars, c.id) : undefined;
      if (old) requireOwner(member, old.authorId);
      state.calendars = [
        ...state.calendars.filter((x) => x.id !== c.id),
        {
          id: entityId,
          name: c.name,
          color: c.color,
          authorId: old?.authorId ?? member.id,
        },
      ];
      for (const e of state.events.filter(
        (e) => e.calendarId === entityId && !e.deleted,
      ))
        e.version++;
      break;
    }
    case "event.save": {
      get(state.calendars, c.calendarId);
      const old = c.id ? get(state.events, c.id) : undefined;
      if (old) requireOwner(member, old.authorId);
      if (old?.deleted) throw new PublicError("El evento está eliminado.");
      if (c.allDay && (c.start.length !== 10 || c.end.length !== 10))
        throw new PublicError("Selecciona fechas sin hora.");
      if (!c.allDay && (c.start.length === 10 || c.end.length === 10))
        throw new PublicError("Selecciona una hora de inicio y fin.");
      if (
        c.end < c.start ||
        (!c.allDay && Date.parse(c.end) <= Date.parse(c.start))
      )
        throw new PublicError("El final debe ser posterior al inicio.");
      if (
        c.assigneeId &&
        !state.members.some(
          (m) => m.id === c.assigneeId && m.active && m.role !== "guest",
        )
      )
        throw new PublicError("Elige un responsable activo.");
      if (c.kind === "chore" && !c.assigneeId)
        throw new PublicError("Elige quién se encarga de la tarea.");
      state.events = [
        ...state.events.filter((e) => e.id !== entityId),
        {
          ...old,
          id: entityId,
          calendarId: c.calendarId,
          title: c.title,
          start: c.start,
          end: c.end,
          allDay: c.allDay,
          kind: c.kind,
          authorId: old?.authorId ?? member.id,
          assigneeId:
            c.kind === "absence"
              ? member.role === "admin"
                ? (c.assigneeId ?? member.id)
                : member.id
              : c.assigneeId,
          completed: old?.completed ?? false,
          version: (old?.version ?? 0) + 1,
          syncedVersion: old?.syncedVersion ?? 0,
        },
      ];
      break;
    }
    case "event.delete": {
      const e = get(state.events, c.id);
      requireOwner(member, e.authorId);
      e.deleted = true;
      e.version++;
      break;
    }
    case "event.complete": {
      const e = get(state.events, c.id);
      if (e.kind !== "chore" || e.deleted)
        throw new PublicError("No es una tarea activa.");
      if (member.role !== "admin" && e.assigneeId !== member.id)
        throw new PublicError(
          "Solo el responsable puede completar esta tarea.",
        );
      e.completed = !e.completed;
      e.version++;
      break;
    }
    case "rotation.save": {
      get(state.calendars, c.calendarId);
      if (
        new Set(c.memberIds).size !== c.memberIds.length ||
        c.memberIds.some(
          (id) =>
            !state.members.some(
              (m) => m.id === id && m.active && m.role !== "guest",
            ),
        )
      )
        throw new PublicError("Elige personas activas, sin repetir.");
      const old = c.id ? get(state.rotations, c.id) : undefined;
      if (old) requireOwner(member, old.authorId);
      if (old) {
        // A new series keeps completed/past occurrences immutable and gives future turns stable IDs.
        old.active = false;
        for (const event of state.events.filter(
          (e) =>
            e.rotationId === old.id &&
            !e.completed &&
            e.start.slice(0, 10) >= today(now),
        )) {
          event.deleted = true;
          event.version++;
        }
        entityId = crypto.randomUUID();
      }
      state.rotations.push({
        id: entityId,
        title: c.title,
        calendarId: c.calendarId,
        start: c.start,
        everyWeeks: c.everyWeeks,
        memberIds: c.memberIds,
        authorId: old?.authorId ?? member.id,
        active: true,
      });
      materializeRotations(state, now);
      break;
    }
    case "rotation.delete": {
      const rotation = get(state.rotations, c.id);
      requireOwner(member, rotation.authorId);
      rotation.active = false;
      for (const e of state.events.filter(
        (e) =>
          e.rotationId === c.id &&
          !e.completed &&
          e.start.slice(0, 10) >= today(now),
      )) {
        e.deleted = true;
        e.version++;
      }
      break;
    }
  }
  state.audit.push({
    id: crypto.randomUUID(),
    authorId: member.id,
    action: c.type,
    entityId,
    month: affectedMonth,
    at: timestamp,
  });
  return entityId;
}
