"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Copy, LoaderCircle } from "lucide-react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { Avatar } from "./avatar";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { generateInvite } from "@/app/actions";
import { balances, euros, parseMoney, splitMoney } from "@/lib/domain/money";
import { currentMonth, today } from "@/lib/domain/dates";
import type {
  Announcement,
  Category,
  Expense,
  HouseCalendar,
  HouseEvent,
  PublicCommunity,
  Rotation,
} from "@/lib/domain/types";
type Selection =
  | { kind: "expense"; item?: Expense }
  | { kind: "payment"; memberId?: string; month?: string }
  | { kind: "event"; item?: HouseEvent; date?: string }
  | { kind: "rotation"; item?: Rotation }
  | { kind: "announcement"; item?: Announcement }
  | { kind: "category"; item?: Category }
  | { kind: "calendar"; item?: HouseCalendar }
  | { kind: "invite"; memberId?: string }
  | { kind: "guest" }
  | { kind: "profile" };
export type ModalSelection = Selection | null;
type Props = {
  selection: Selection;
  state: PublicCommunity;
  memberId: string;
  month: string;
  pending: boolean;
  error: string;
  save: (command: unknown) => Promise<boolean>;
  close: () => void;
  returnFocus: React.RefObject<HTMLElement | null>;
};
const titles = {
  expense: "Un gasto para compartir",
  payment: "Registrar un movimiento",
  event: "Algo en el calendario",
  rotation: "Nos turnamos",
  announcement: "Cuéntaselo a la casa",
  category: "Categoría de gasto",
  calendar: "Un calendario para casa",
  invite: "Un hueco para alguien más",
  guest: "Añadir una visita",
  profile: "Así te ve tu casa",
};
export function FormModal(props: Props) {
  return (
    <Modal
      open
      onClose={props.close}
      returnFocus={props.returnFocus}
      title={titles[props.selection.kind]}
      description={
        props.selection.kind === "expense"
          ? "Tú añades el gasto. Nosotros hacemos las cuentas."
          : undefined
      }
    >
      <ModalForm {...props} />
    </Modal>
  );
}
function Submit({
  pending,
  label = "Guardar cambios",
}: {
  pending: boolean;
  label?: string;
}) {
  return (
    <Button type="submit" disabled={pending} className="form-submit">
      {pending && <LoaderCircle size={16} className="spin" />}
      {pending ? "Guardando…" : label}
    </Button>
  );
}
function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <div role="alert" className="error-box">
      {error}
    </div>
  ) : null;
}
function ModalForm(props: Props) {
  const { selection } = props;
  if (selection.kind === "expense")
    return <ExpenseForm {...props} item={selection.item} />;
  if (selection.kind === "payment")
    return (
      <PaymentForm
        {...props}
        target={selection.memberId}
        paymentMonth={selection.month}
      />
    );
  if (selection.kind === "event")
    return (
      <EventForm
        {...props}
        item={selection.item}
        initialDate={selection.date}
      />
    );
  if (selection.kind === "rotation")
    return <RotationForm {...props} item={selection.item} />;
  if (selection.kind === "invite")
    return <InviteForm {...props} target={selection.memberId} />;
  if (selection.kind === "profile") return <ProfileForm {...props} />;
  return <SimpleForm {...props} />;
}
function ExpenseForm({
  state,
  memberId,
  month,
  item,
  save,
  pending,
  error,
}: Props & { item?: Expense }) {
  const available = state.members.filter(
    (m) =>
      ((m.active ||
        (month < currentMonth() && !!m.leftMonth && month <= m.leftMonth)) &&
        (m.role === "guest"
          ? m.guestMonth === month
          : m.joinedMonth <= month)) ||
      item?.shares.some((s) => s.memberId === m.id) ||
      item?.payerId === m.id,
  );
  const defaultIds = available
    .filter((m) => m.role !== "guest" && (m.active || month < currentMonth()))
    .map((m) => m.id);
  const [selected, setSelected] = useState(
    item?.shares.map((s) => s.memberId) ?? defaultIds,
  );
  const [special, setSpecial] = useState(
    !!item &&
      (selected.length !== defaultIds.length ||
        selected.some((id) => !defaultIds.includes(id))),
  );
  const [amount, setAmount] = useState(
    item ? (item.amount / 100).toFixed(2) : "",
  );
  let preview: { memberId: string; amount: number }[] = [];
  try {
    preview = splitMoney(parseMoney(amount), selected);
  } catch {
    /* Preview appears once the amount and participants are valid. */
  }
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await save({
          type: "expense.save",
          id: item?.id,
          title: f.get("title"),
          amount,
          categoryId: f.get("categoryId"),
          month: item?.month ?? month,
          date: f.get("date"),
          payerId: f.get("payerId"),
          memberIds: selected,
        });
      }}
    >
      <label>
        ¿Qué habéis pagado?
        <input
          name="title"
          placeholder="Por ejemplo, factura de la luz"
          defaultValue={item?.title}
          required
          maxLength={120}
          autoFocus
        />
      </label>
      <div className="form-grid">
        <label>
          Importe (€)
          <input
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label>
          Categoría
          <select name="categoryId" defaultValue={item?.categoryId ?? "other"}>
            {state.categories
              .filter((c) => !c.archived || c.id === item?.categoryId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>
          Fecha
          <input
            type="date"
            name="date"
            defaultValue={
              item?.date ?? (month === currentMonth() ? today() : `${month}-01`)
            }
            required
          />
        </label>
        <label>
          ¿Quién lo ha adelantado?
          <select name="payerId" defaultValue={item?.payerId ?? memberId}>
            {available.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.id === memberId ? " (tú)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={special}
          onChange={(e) => {
            setSpecial(e.target.checked);
            if (!e.target.checked) setSelected(defaultIds);
          }}
        />
        División especial <span className="muted">Elegir participantes</span>
      </label>
      {special && (
        <div className="participant-checks">
          {available.map((m) => (
            <label key={m.id} className="checkbox-label">
              <input
                type="checkbox"
                checked={selected.includes(m.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, m.id]
                      : selected.filter((id) => id !== m.id),
                  )
                }
              />
              <Avatar name={m.name} index={m.avatar} size={28} />
              {m.name}
              {m.role === "guest" && <span className="tag">Visita</span>}
            </label>
          ))}
        </div>
      )}
      <div className="split-preview">
        <div className="split-heading">
          Así queda el reparto <span>{selected.length} personas</span>
        </div>
        {preview.length ? (
          preview.map((s) => (
            <div className="split-row" key={s.memberId}>
              <span>
                {state.members.find((m) => m.id === s.memberId)?.name}
              </span>
              <strong>{euros(s.amount)}</strong>
            </div>
          ))
        ) : (
          <p className="muted">
            Introduce un importe y elige al menos una persona.
          </p>
        )}
      </div>
      <ErrorMessage error={error} />
      <Submit
        pending={pending}
        label={item ? "Guardar gasto" : "Añadir gasto"}
      />
    </form>
  );
}
function PaymentForm({
  state,
  memberId,
  month,
  paymentMonth,
  target,
  save,
  pending,
  error,
}: Props & { target?: string; paymentMonth?: string }) {
  const me = state.members.find((m) => m.id === memberId)!,
    m = paymentMonth ?? month;
  const options = state.members.filter(
    (p) => p.role !== "admin" && (me.role === "admin" || p.id === memberId),
  );
  const [selected, setSelected] = useState(target ?? options[0]?.id ?? "");
  const rows = balances(state, m),
    due = (id: string) => rows.find((b) => b.memberId === id)?.pending ?? 0;
  const [amount, setAmount] = useState(
    (Math.abs(due(selected)) / 100).toFixed(2),
  );
  const [direction, setDirection] = useState(
    due(selected) < 0 && me.role === "admin" ? "from_admin" : "to_admin",
  );
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        await save({
          type: "payment.add",
          memberId: selected,
          month: m,
          amount,
          direction,
        });
      }}
    >
      <p className="muted">
        Registra el dinero que ya se ha entregado. No se realiza ninguna
        transferencia desde la app.
      </p>
      <label>
        Persona
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setAmount((Math.abs(due(e.target.value)) / 100).toFixed(2));
            setDirection(
              due(e.target.value) < 0 && me.role === "admin"
                ? "from_admin"
                : "to_admin",
            );
          }}
        >
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {me.role === "admin" && (
        <label>
          Movimiento
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            <option value="to_admin">Pago recibido por el administrador</option>
            <option value="from_admin">
              Devolución entregada al compañero
            </option>
          </select>
        </label>
      )}
      <label>
        Importe (€)
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </label>
      <div className="info-box">
        Pendiente de {due(selected) < 0 ? "devolver" : "pagar"}:{" "}
        <strong>{euros(Math.abs(due(selected)))}</strong>
        <br />
        <small>Puedes registrar un pago parcial.</small>
      </div>
      <ErrorMessage error={error} />
      <Submit pending={pending} label="Registrar pago" />
    </form>
  );
}
function EventForm({
  state,
  memberId,
  item,
  initialDate,
  save,
  pending,
  error,
}: Props & { item?: HouseEvent; initialDate?: string }) {
  const [allDay, setAllDay] = useState(item?.allDay ?? true),
    [kind, setKind] = useState(item?.kind ?? "event");
  const fieldDate = (value?: string) =>
    !value
      ? (initialDate ?? today())
      : value.length === 10
        ? value
        : formatInTimeZone(value, "Europe/Madrid", "yyyy-MM-dd'T'HH:mm");
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const stamp = (field: string) =>
          allDay
            ? String(f.get(field))
            : fromZonedTime(
                String(f.get(field)),
                "Europe/Madrid",
              ).toISOString();
        await save({
          type: "event.save",
          id: item?.id,
          title: f.get("title"),
          calendarId: f.get("calendarId"),
          start: stamp("start"),
          end: stamp("end"),
          allDay,
          kind,
          assigneeId: String(f.get("assigneeId") || "") || undefined,
        });
      }}
    >
      <label>
        Título
        <input
          name="title"
          defaultValue={item?.title}
          placeholder="Cena de piso, estaré fuera…"
          required
          maxLength={120}
          autoFocus
        />
      </label>
      <div className="form-grid">
        <label>
          Tipo
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="event">Evento</option>
            <option value="absence">Ausencia</option>
            <option value="chore">Tarea</option>
          </select>
        </label>
        <label>
          Calendario
          <select name="calendarId" defaultValue={item?.calendarId ?? "house"}>
            {state.calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
        />
        Todo el día
      </label>
      <div className="form-grid" key={String(allDay)}>
        <label>
          Inicio
          <input
            type={allDay ? "date" : "datetime-local"}
            name="start"
            defaultValue={
              allDay
                ? fieldDate(item?.start).slice(0, 10)
                : fieldDate(item?.start).padEnd(16, "T18:00")
            }
            required
          />
        </label>
        <label>
          Fin {allDay && "(incluido)"}
          <input
            type={allDay ? "date" : "datetime-local"}
            name="end"
            defaultValue={
              allDay
                ? fieldDate(item?.end).slice(0, 10)
                : fieldDate(item?.end).padEnd(16, "T19:00")
            }
            required
          />
        </label>
      </div>
      {!allDay && <small className="muted">Horas de Madrid.</small>}
      <label>
        {kind === "absence" ? "Quién estará fuera" : "Responsable"}
        <select
          name="assigneeId"
          defaultValue={
            item?.assigneeId ?? (kind === "absence" ? memberId : "")
          }
          disabled={
            kind === "absence" &&
            state.members.find((m) => m.id === memberId)?.role !== "admin"
          }
        >
          {kind === "event" && <option value="">Toda la casa</option>}
          {state.members
            .filter((m) => m.active && m.role !== "guest")
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
      </label>
      <ErrorMessage error={error} />
      <Submit
        pending={pending}
        label={item ? "Guardar evento" : "Añadir al calendario"}
      />
    </form>
  );
}
function RotationForm({
  state,
  item,
  save,
  pending,
  error,
}: Props & { item?: Rotation }) {
  const residents = state.members.filter((m) => m.active && m.role !== "guest");
  const [order, setOrder] = useState(
    item?.memberIds ?? residents.map((m) => m.id),
  );
  function move(index: number, delta: number) {
    const copy = [...order];
    [copy[index], copy[index + delta]] = [copy[index + delta], copy[index]];
    setOrder(copy);
  }
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await save({
          type: "rotation.save",
          id: item?.id,
          title: f.get("title"),
          calendarId: f.get("calendarId"),
          start: f.get("start"),
          everyWeeks: Number(f.get("everyWeeks")),
          memberIds: order,
        });
      }}
    >
      <label>
        Tarea
        <input
          name="title"
          defaultValue={item?.title}
          placeholder="Limpieza del baño"
          required
          maxLength={120}
        />
      </label>
      <label>
        Calendario
        <select name="calendarId" defaultValue={item?.calendarId ?? "chores"}>
          {state.calendars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        <label>
          Primer turno
          <input
            type="date"
            name="start"
            defaultValue={today()}
            min={today()}
            required
          />
        </label>
        <label>
          Cada cuántas semanas
          <input
            type="number"
            name="everyWeeks"
            min={1}
            max={12}
            defaultValue={item?.everyWeeks ?? 1}
            required
          />
        </label>
      </div>
      <div>
        <p className="field-label">Orden de los turnos</p>
        <div className="rotation-order">
          {order.map((id, i) => {
            const m = residents.find((p) => p.id === id)!;
            return (
              <div key={id}>
                <span className="order-index">{i + 1}</span>
                <Avatar name={m.name} index={m.avatar} size={30} />
                <span>{m.name}</span>
                <div className="row-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Subir a ${m.name}`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Bajar a ${m.name}`}
                    disabled={i === order.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setOrder(order.filter((mid) => mid !== id))}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {residents
          .filter((m) => !order.includes(m.id))
          .map((m) => (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              key={m.id}
              onClick={() => setOrder([...order, m.id])}
            >
              + {m.name}
            </Button>
          ))}
      </div>
      <div className="info-box">
        Los turnos se preparan para los próximos 90 días y se amplían
        automáticamente. Las ausencias no alteran el orden.
        {item &&
          " Al guardar, se sustituyen solo los turnos futuros pendientes."}
      </div>
      <ErrorMessage error={error} />
      <Submit
        pending={pending}
        label={item ? "Actualizar turnos" : "Crear turnos"}
      />
    </form>
  );
}
function InviteForm({ target, state, close }: Props & { target?: string }) {
  const [link, setLink] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [copied, setCopied] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setPending(true);
        try {
          const result = await generateInvite({
            name: String(f.get("name") || ""),
            memberId: target,
          });
          if (!result.ok) setError(result.error);
          else setLink(result.value!);
        } catch {
          setError("No se pudo crear la invitación. Inténtalo de nuevo.");
        } finally {
          setPending(false);
        }
      }}
    >
      {link ? (
        <>
          <div className="success-box">
            <Check size={19} />
            Su hueco ya está preparado.
          </div>
          <p className="muted">
            Comparte este enlace solo con esa persona. Le permitirá entrar y
            recuperar su acceso.
          </p>
          <label>
            Enlace personal
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                setError("Selecciona y copia el enlace manualmente.");
              }
            }}
          >
            {copied ? <Check size={17} /> : <Copy size={17} />}
            {copied ? "Enlace copiado" : "Copiar enlace"}
          </Button>
          <Button type="button" onClick={close}>
            Listo
          </Button>
        </>
      ) : (
        <>
          <p className="muted">
            {target
              ? `Generar un nuevo enlace para ${state.members.find((m) => m.id === target)?.name} cerrará sus sesiones anteriores.`
              : "Cada compañero recibe su propio enlace. Al entrar podrá elegir su nombre y avatar."}
          </p>
          {!target && (
            <label>
              Nombre de tu compañero
              <input
                name="name"
                placeholder="Por ejemplo, Marta"
                required
                maxLength={80}
              />
            </label>
          )}
          <Submit
            pending={pending}
            label={target ? "Regenerar enlace" : "Crear invitación"}
          />
        </>
      )}
      <ErrorMessage error={error} />
    </form>
  );
}
function ProfileForm({ state, memberId, save, pending, error }: Props) {
  const me = state.members.find((m) => m.id === memberId)!,
    [avatar, setAvatar] = useState(me.avatar);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        await save({
          type: "profile.save",
          name: new FormData(e.currentTarget).get("name"),
          avatar,
        });
      }}
    >
      <label>
        Tu nombre
        <input name="name" defaultValue={me.name} maxLength={80} required />
      </label>
      <div className="avatar-picker" role="group" aria-label="Elige tu avatar">
        {Array.from({ length: 8 }, (_, i) => (
          <button
            type="button"
            key={i}
            className={avatar === i ? "selected" : ""}
            onClick={() => setAvatar(i)}
            aria-label={`Avatar ${i + 1}`}
            aria-pressed={avatar === i}
          >
            <Avatar name={`Avatar ${i + 1}`} index={i} size={56} />
          </button>
        ))}
      </div>
      <ErrorMessage error={error} />
      <Submit pending={pending} />
    </form>
  );
}
function SimpleForm({ selection, month, save, pending, error }: Props) {
  const item = "item" in selection ? selection.item : undefined;
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (selection.kind === "announcement")
          await save({
            type: "announcement.save",
            id: selection.item?.id,
            body: f.get("body"),
          });
        if (selection.kind === "category")
          await save({
            type: "category.save",
            id: selection.item?.id,
            name: f.get("name"),
            color: f.get("color"),
            icon: f.get("icon"),
          });
        if (selection.kind === "calendar")
          await save({
            type: "calendar.save",
            id: selection.item?.id,
            name: f.get("name"),
            color: f.get("color"),
          });
        if (selection.kind === "guest")
          await save({
            type: "member.guest",
            name: f.get("name"),
            month: f.get("month"),
          });
      }}
    >
      {selection.kind === "announcement" ? (
        <label>
          Tu mensaje
          <textarea
            name="body"
            placeholder="Hay comida en la nevera, por si alguien quiere…"
            defaultValue={selection.item?.body}
            rows={5}
            required
            maxLength={4000}
            autoFocus
          />
        </label>
      ) : (
        <label>
          Nombre
          <input
            name="name"
            defaultValue={item && "name" in item ? item.name : ""}
            required
            maxLength={120}
            autoFocus
          />
        </label>
      )}
      {(selection.kind === "category" || selection.kind === "calendar") && (
        <label>
          Color
          <input
            type="color"
            name="color"
            defaultValue={selection.item?.color ?? "#D97667"}
          />
        </label>
      )}
      {selection.kind === "category" && (
        <label>
          Icono
          <select name="icon" defaultValue={selection.item?.icon ?? "other"}>
            <option value="bolt">Luz</option>
            <option value="water">Agua</option>
            <option value="flame">Gas</option>
            <option value="wifi">Internet</option>
            <option value="sparkles">Limpieza</option>
            <option value="basket">Compra</option>
            <option value="other">Otros</option>
          </select>
        </label>
      )}
      {selection.kind === "guest" && (
        <>
          <label>
            Mes de la visita
            <input type="month" name="month" defaultValue={month} required />
          </label>
          <div className="info-box">
            No tendrá cuenta. Podrás incluirlo en gastos con «División especial»
            y registrar sus pagos.
          </div>
        </>
      )}
      <ErrorMessage error={error} />
      <Submit
        pending={pending}
        label={
          selection.kind === "announcement" ? "Publicar mensaje" : "Guardar"
        }
      />
    </form>
  );
}
