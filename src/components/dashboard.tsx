"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  DoorOpen,
  Flame,
  House,
  LayoutGrid,
  Leaf,
  LogOut,
  MessageCircle,
  Pencil,
  Pin,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  TrendingDown,
  Users,
  Wallet,
  Wifi,
  X,
  Zap,
  Droplets,
  ShoppingBasket,
  RefreshCw,
  Link2,
  AlertCircle,
  Clock3,
} from "lucide-react";
import {
  dispatch,
  disconnectGoogle,
  listGoogleCalendars,
  logout,
  retryGoogle,
  selectGoogleCalendar,
} from "@/app/actions";
import type { ActionResult } from "@/app/actions";
import { balances, euros, reimbursementDue } from "@/lib/domain/money";
import {
  addDays,
  currentMonth,
  dateLabel,
  monthEnd,
  monthLabel,
  shiftMonth,
  today,
} from "@/lib/domain/dates";
import type {
  Announcement,
  Expense,
  HouseEvent,
  PublicCommunity,
} from "@/lib/domain/types";
import { Avatar } from "./avatar";
import { Logo } from "./logo";
import { HouseIllustration } from "./house-illustration";
import { Button } from "./ui/button";
import { FormModal, type ModalSelection } from "./forms";
import { ExpenseChart } from "./expense-chart";
import { FinancePanel } from "./finance-panel";
import { SharePanel } from "./share-panel";
const icons = {
  bolt: Zap,
  water: Droplets,
  flame: Flame,
  wifi: Wifi,
  sparkles: Sparkles,
  basket: ShoppingBasket,
  other: LayoutGrid,
};
const sections = [
  { id: "inicio", label: "Inicio", icon: House, href: "/" },
  { id: "gastos", label: "Gastos", icon: Wallet, href: "/gastos" },
  {
    id: "calendario",
    label: "Calendario",
    icon: CalendarDays,
    href: "/calendario",
  },
  { id: "tablon", label: "Tablón", icon: MessageCircle, href: "/tablon" },
];
type Props = {
  state: PublicCommunity;
  memberId: string;
  month: string;
  view: string;
  demo: boolean;
  baseUrl: string;
  googleStatus?: string;
};
export function Dashboard({
  state,
  memberId,
  month,
  view,
  demo,
  baseUrl,
  googleStatus,
}: Props) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const router = useRouter(),
    me = state.members.find((m) => m.id === memberId)!,
    admin = me.role === "admin";
  const [modal, setModal] = useState<ModalSelection>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("all");
  const [calendarFilter, setCalendarFilter] = useState("all"),
    [calendarMode, setCalendarMode] = useState("month");
  const [googleOptions, setGoogleOptions] = useState<
    { id: string; summary: string }[]
  >([]);
  const rows = balances(state, month),
    mine = rows.find((r) => r.memberId === memberId)!;
  const expenses = state.expenses
    .filter((e) => e.month === month)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const toCollect = rows
    .filter((b) => b.memberId !== memberId && b.pending > 0)
    .reduce((s, b) => s + b.pending, 0);
  const toReturn = rows
    .filter((b) => b.memberId !== memberId && b.pending < 0)
    .reduce((s, b) => s - b.pending, 0);
  const previousTotal = state.expenses
    .filter((e) => e.month === shiftMonth(month, -1))
    .reduce((s, e) => s + e.amount, 0);
  const active = state.members.filter((m) => m.active && m.role !== "guest");
  const announcements = [...state.announcements].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.createdAt.localeCompare(a.createdAt),
  );
  const upcoming = state.events
    .filter((e) => !e.deleted && !e.completed && e.end.slice(0, 10) >= today())
    .sort((a, b) => a.start.localeCompare(b.start));
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  function open(selection: ModalSelection) {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setError("");
    setModal(selection);
  }
  async function run(command: unknown, close = true) {
    setPending(true);
    setError("");
    try {
      const result = await dispatch(command);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      if (close) setModal(null);
      setToast("Todo guardado. Una cosa menos.");
      router.refresh();
      return true;
    } catch {
      setError(
        "No se pudo guardar. Comprueba tu conexión y vuelve a intentarlo.",
      );
      return false;
    } finally {
      setPending(false);
    }
  }
  async function googleAction(action: () => Promise<ActionResult>) {
    setPending(true);
    setError("");
    try {
      const result = await action();
      if (!result.ok) setError(result.error);
      else {
        setToast("Conexión actualizada");
        router.refresh();
      }
    } catch {
      setError("No se pudo actualizar Google Calendar.");
    } finally {
      setPending(false);
    }
  }
  const person = (id: string) => state.members.find((m) => m.id === id)!;
  const canEdit = (authorId: string) => admin || authorId === memberId;
  const changeMonth = (next: string) =>
    router.push(`${view === "inicio" ? "/" : `/${view}`}?month=${next}`);
  const monthPicker = (
    <div className="month-picker">
      <button
        aria-label="Mes anterior"
        onClick={() => changeMonth(shiftMonth(month, -1))}
      >
        <ChevronLeft size={17} />
      </button>
      <span>
        <CalendarDays size={15} />
        {monthLabel(month)}
      </span>
      <button
        aria-label="Mes siguiente"
        onClick={() => changeMonth(shiftMonth(month, 1))}
      >
        <ChevronRight size={17} />
      </button>
    </div>
  );
  function renderCategoryIcon({
    id,
    small = false,
  }: {
    id: string;
    small?: boolean;
  }) {
    const c = state.categories.find((c) => c.id === id),
      Icon = icons[c?.icon as keyof typeof icons] ?? LayoutGrid;
    return (
      <span
        className={`category-icon ${small ? "small" : ""}`}
        style={{
          background: `${c?.color ?? "#A49888"}20`,
          color: c?.color ?? "#A49888",
        }}
      >
        <Icon size={small ? 17 : 21} strokeWidth={1.7} />
      </span>
    );
  }
  function renderExpenseRows({
    items,
    full = false,
  }: {
    items: Expense[];
    full?: boolean;
  }) {
    return (
      <div className="expense-list">
        {!items.length && (
          <Empty
            icon={Wallet}
            title="Un mes por estrenar"
            text="Añade el primer gasto y nosotros hacemos las cuentas."
          />
        )}
        {items.map((e) => {
          const category = state.categories.find((c) => c.id === e.categoryId)!,
            payer = person(e.payerId);
          return (
            <div className="expense-row" key={e.id}>
              {renderCategoryIcon({ id: e.categoryId })}
              <div className="expense-description">
                <strong>{e.title}</strong>
                <span>
                  {category.name}
                  <i>·</i>
                  {dateLabel(e.date)}
                  {full && (
                    <>
                      <i>·</i>
                      {e.shares.length}{" "}
                      {e.shares.length === 1 ? "persona" : "personas"}
                    </>
                  )}
                </span>
              </div>
              <div className="expense-payer">
                <Avatar name={payer.name} index={payer.avatar} size={26} />
                <span>{payer.id === memberId ? "Tú" : payer.name}</span>
              </div>
              <div className="expense-amount">
                <strong>{euros(e.amount)}</strong>
                <span>
                  {euros(
                    e.shares.find((s) => s.memberId === memberId)?.amount ?? 0,
                  )}{" "}
                  tu parte
                </span>
              </div>
              {full && (
                <div className="row-actions">
                  {canEdit(e.authorId) &&
                    (admin || month === currentMonth()) && (
                      <>
                        <button
                          className="icon-button"
                          onClick={() => open({ kind: "expense", item: e })}
                          aria-label={`Editar ${e.title}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-button danger"
                          disabled={pending}
                          onClick={() => {
                            if (
                              confirm(
                                `¿Eliminar «${e.title}»? Los pagos registrados se conservarán.`,
                              )
                            )
                              void run(
                                { type: "expense.delete", id: e.id },
                                false,
                              );
                          }}
                          aria-label={`Eliminar ${e.title}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  function renderEventRow({ event }: { event: HouseEvent }) {
    const cal = state.calendars.find((c) => c.id === event.calendarId),
      assignee = event.assigneeId ? person(event.assigneeId) : undefined;
    const date = new Date(`${event.start.slice(0, 10)}T12:00:00Z`);
    const editable = canEdit(event.authorId);
    const absent =
      event.kind === "chore" &&
      state.events.some(
        (e) =>
          !e.deleted &&
          e.kind === "absence" &&
          e.assigneeId === event.assigneeId &&
          e.start.slice(0, 10) <= event.start.slice(0, 10) &&
          e.end.slice(0, 10) >= event.start.slice(0, 10),
      );
    return (
      <div
        key={event.id}
        className={`event-row ${event.completed ? "event-completed" : ""}`}
      >
        <div className="event-date">
          <span>
            {new Intl.DateTimeFormat("es-ES", {
              month: "short",
              timeZone: "UTC",
            })
              .format(date)
              .replace(".", "")}
          </span>
          <strong>{date.getUTCDate()}</strong>
        </div>
        <div className="event-copy">
          <strong>{event.title}</strong>
          <span>
            <i className="color-dot" style={{ background: cal?.color }} />
            {cal?.name}
            {assignee && (
              <>
                {" "}
                · {assignee.id === memberId ? "Te toca a ti" : assignee.name}
              </>
            )}
            {event.start !== event.end && event.allDay && (
              <> · Hasta {dateLabel(event.end)}</>
            )}
            {!event.allDay && (
              <>
                {" "}
                ·{" "}
                {new Intl.DateTimeFormat("es-ES", {
                  timeZone: "Europe/Madrid",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(event.start))}
              </>
            )}
          </span>
          {absent && (
            <small className="warning-text">
              Coincide con una ausencia. Podéis reasignar el turno.
            </small>
          )}
          {state.google.calendarId && (
            <small className={event.syncError ? "warning-text" : "sync-label"}>
              {event.syncError
                ? "Pendiente · Revisar conexión"
                : event.version === event.syncedVersion
                  ? "Sincronizado con Google"
                  : "Sincronización pendiente"}
            </small>
          )}
        </div>
        {assignee && (
          <Avatar name={assignee.name} index={assignee.avatar} size={30} />
        )}
        <div className="row-actions">
          {event.kind === "chore" &&
            (admin || event.assigneeId === memberId) && (
              <button
                disabled={pending}
                className={`task-check ${event.completed ? "checked" : ""}`}
                aria-label={
                  event.completed
                    ? `Reabrir ${event.title}`
                    : `Completar ${event.title}`
                }
                onClick={() =>
                  run({ type: "event.complete", id: event.id }, false)
                }
              >
                <Check size={15} />
              </button>
            )}
          {view === "calendario" && editable && (
            <>
              <button
                className="icon-button"
                aria-label={`Editar ${event.title}`}
                onClick={() => open({ kind: "event", item: event })}
              >
                <Pencil size={14} />
              </button>
              <button
                disabled={pending}
                className="icon-button danger"
                aria-label={`Eliminar ${event.title}`}
                onClick={() => {
                  if (confirm("¿Eliminar este evento?"))
                    void run({ type: "event.delete", id: event.id }, false);
                }}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }
  function renderAnnouncementCard({
    item,
    compact = false,
  }: {
    item: Announcement;
    compact?: boolean;
  }) {
    const author = person(item.authorId);
    return (
      <article
        key={item.id}
        className={`announcement ${item.pinned ? "pinned" : ""} ${compact ? "compact" : ""}`}
      >
        <div className="announcement-author">
          <Avatar name={author.name} index={author.avatar} size={34} />
          <div>
            <strong>{author.name}</strong>
            <span>{dateLabel(item.createdAt)}</span>
          </div>
          {item.pinned && (
            <span className="pin-label">
              <Pin size={12} />
              Fijado
            </span>
          )}
          {!compact && (
            <div className="row-actions">
              {admin && (
                <button
                  className={`icon-button ${item.pinned ? "coral" : ""}`}
                  aria-label={
                    item.pinned ? "Desfijar anuncio" : "Fijar anuncio"
                  }
                  onClick={() =>
                    run({ type: "announcement.pin", id: item.id }, false)
                  }
                >
                  <Pin size={15} />
                </button>
              )}
              {canEdit(item.authorId) && (
                <>
                  <button
                    className="icon-button"
                    aria-label="Editar anuncio"
                    onClick={() => open({ kind: "announcement", item })}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label="Eliminar anuncio"
                    onClick={() => {
                      if (confirm("¿Eliminar este anuncio?"))
                        void run(
                          { type: "announcement.delete", id: item.id },
                          false,
                        );
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <p>{item.body}</p>
      </article>
    );
  }
  function renderBalanceTable() {
    return (
      <div className="balance-list">
        {rows
          .filter(
            (b) =>
              (admin || b.memberId === memberId) &&
              (b.share ||
                b.advanced ||
                b.rent ||
                (person(b.memberId).active &&
                  (person(b.memberId).role !== "guest" ||
                    person(b.memberId).guestMonth === month))),
          )
          .map((b) => {
            const m = person(b.memberId),
              selfAdmin = m.role === "admin";
            return (
              <div className="balance-row" key={m.id}>
                <Avatar name={m.name} index={m.avatar} size={35} />
                <div className="balance-person">
                  <strong>
                    {m.id === memberId ? `${m.name} (tú)` : m.name}
                  </strong>
                  <span>
                    {m.role === "guest" ? "Visita · " : ""}Su parte:{" "}
                    {euros(b.share)}
                  </span>
                </div>
                <div className="balance-number">
                  <strong>
                    {euros(Math.abs(selfAdmin ? b.share : b.pending))}
                  </strong>
                  <span
                    className={
                      selfAdmin
                        ? ""
                        : b.pending < 0
                          ? "green"
                          : b.pending === 0
                            ? "green"
                            : ""
                    }
                  >
                    {selfAdmin
                      ? "Cuota propia"
                      : b.pending < 0
                        ? "Por recibir"
                        : b.pending === 0
                          ? "Al día"
                          : "Por pagar"}
                  </span>
                </div>
                {!selfAdmin &&
                  (admin || (m.id === memberId && b.sharedPending > 0)) &&
                  b.sharedPending !== 0 && (
                    <button
                      className="icon-button"
                      aria-label={`Registrar pago de ${m.name}`}
                      onClick={() => open({ kind: "payment", memberId: m.id })}
                    >
                      <ArrowRight size={17} />
                    </button>
                  )}
                {!selfAdmin && b.pending === 0 && (
                  <CheckCheck size={17} className="green" />
                )}
              </div>
            );
          })}
      </div>
    );
  }
  const pastDue = state.boards
    .filter((m) => m < currentMonth())
    .sort()
    .flatMap((m) =>
      balances(state, m)
        .filter(
          (b) =>
            b.pending !== 0 &&
            person(b.memberId).role !== "admin" &&
            (admin || b.memberId === memberId),
        )
        .map((b) => ({ ...b, month: m })),
    );
  const notice = !modal && error && (
    <div role="alert" className="error-box page-error">
      <AlertCircle size={17} />
      {error}
      <button
        className="icon-button"
        aria-label="Cerrar error"
        onClick={() => setError("")}
      >
        <X size={17} />
      </button>
    </div>
  );
  return (
    <>
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <nav className="desktop-nav" aria-label="Navegación principal">
            {sections.map((s) => (
              <Link
                key={s.id}
                href={s.href}
                className={view === s.id ? "active" : ""}
                aria-current={view === s.id ? "page" : undefined}
              >
                <s.icon size={17} strokeWidth={1.8} />
                {s.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Link
              href="/settings"
              className={`icon-button ${view === "settings" ? "active" : ""}`}
              aria-label="Ajustes de la comunidad"
            >
              <Settings size={20} strokeWidth={1.6} />
            </Link>
            <span className="header-divider" />
            <button
              className="profile-button"
              onClick={() => open({ kind: "profile" })}
              aria-label="Editar mi perfil"
            >
              <Avatar name={me.name} index={me.avatar} size={36} />
              <span>{me.name}</span>
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="main-container">
        <div className="house-context">
          <span>
            <House size={13} />
            {state.name}
            <span className="context-divider">/</span>
            <span className="muted">
              {view === "settings"
                ? "Ajustes"
                : sections.find((s) => s.id === view)?.label}
            </span>
          </span>
          <span className="house-members">
            <span className="avatar-stack">
              {active.slice(0, 5).map((m) => (
                <Avatar key={m.id} name={m.name} index={m.avatar} size={25} />
              ))}
            </span>
            <span>{active.length} en casa</span>
            {demo && <span className="demo-label">DEMO</span>}
          </span>
        </div>
        {notice}
        {view === "inicio" && (
          <>
            <div className="page-heading">
              <div>
                <div className="greeting">
                  HOLA, {me.name.toUpperCase()} <Sun size={15} />
                </div>
                <h1>Qué bien estar en casa.</h1>
                <p>Todo lo que compartís, en un mismo lugar.</p>
              </div>
              {monthPicker}
            </div>
            <section className="welcome-banner">
              <div className="welcome-copy">
                <span className="banner-eyebrow">
                  <span className="status-dot" />
                  VUESTRA CASA, AL DÍA
                </span>
                <h2>
                  Menos hacer cuentas.
                  <br />
                  Más hacer vida juntos.
                </h2>
                <p>
                  Un poquito de orden para disfrutar
                  <br className="desktop-only" /> de las pequeñas cosas de casa.
                </p>
                <Button onClick={() => open({ kind: "expense" })}>
                  <Plus size={17} />
                  Añadir gasto
                </Button>
              </div>
              <HouseIllustration />
              <div className="home-note">
                <Leaf size={13} />
                Aquí se vive a gusto.
              </div>
            </section>
            <div className="summary-grid">
              <Metric
                label={
                  admin
                    ? "Tu parte este mes"
                    : mine.pending < 0
                      ? "Te toca recibir"
                      : "Te toca pagar"
                }
                value={euros(admin ? mine.share : Math.abs(mine.pending))}
                icon={Wallet}
                accent
                footer={
                  admin
                    ? `Alquiler propio: ${euros(mine.rent)} (${mine.rentPaid ? "pagado" : "pendiente"}) · Has adelantado ${euros(mine.advanced)}`
                    : `Gastos: ${euros(mine.billableShare)} · Alquiler: ${euros(mine.rent)} (${mine.rentPaid ? "pagado" : "pendiente"}) · Adelantado: ${euros(mine.advanced)}`
                }
                action={
                  !admin && mine.sharedPending > 0 ? (
                    <button
                      className="text-link"
                      onClick={() => open({ kind: "payment", memberId })}
                    >
                      He pagado <ArrowUpRight size={14} />
                    </button>
                  ) : undefined
                }
              />
              <Metric
                label="Gasto total del piso"
                value={euros(total)}
                icon={House}
                footer={
                  previousTotal
                    ? `${Math.abs(Math.round(((total - previousTotal) / previousTotal) * 100))}% ${total <= previousTotal ? "menos" : "más"} que el mes anterior`
                    : "Vuestro mes empieza aquí"
                }
                trend={!!previousTotal && total < previousTotal}
              />
              <Metric
                label={admin ? "Por cobrar / devolver" : "Cierre del mes"}
                value={
                  admin
                    ? euros(toCollect)
                    : `${Number(monthEnd(month).slice(-2))} ${monthLabel(month, true)}`
                }
                icon={admin ? ArrowDownLeft : CalendarDays}
                footer={
                  admin
                    ? `${euros(toReturn)} por devolver a compañeros`
                    : "Los pendientes se conservan en el histórico"
                }
              />
            </div>
            {!!pastDue.length && (
              <Link className="history-notice" href="/gastos">
                <AlertCircle size={16} />
                <span>
                  Hay {pastDue.length}{" "}
                  {pastDue.length === 1
                    ? "saldo pendiente"
                    : "saldos pendientes"}{" "}
                  de meses anteriores.
                </span>
                <ArrowRight size={15} />
              </Link>
            )}
            <div className="overview-grid">
              <div className="overview-main">
                <section className="panel">
                  <PanelHeader
                    title="Los gastos de este mes"
                    subtitle={`${expenses.length} gastos compartidos · ${monthLabel(month)}`}
                    action={
                      <Link
                        className="text-link"
                        href={`/gastos?month=${month}`}
                      >
                        Ver todos <ArrowRight size={14} />
                      </Link>
                    }
                  />
                  {renderExpenseRows({ items: expenses.slice(0, 5) })}
                  <div className="panel-footer">
                    <span>Las cuentas claras, la convivencia fácil.</span>
                    <ShieldCheck size={15} />
                  </div>
                </section>
                <section className="panel chart-panel">
                  <PanelHeader
                    title="Así van vuestros gastos"
                    subtitle="Un vistazo a los últimos seis meses"
                    action={<span className="tag">Mensual</span>}
                  />
                  <ExpenseChart state={state} month={month} />
                </section>
              </div>
              <aside className="overview-aside">
                <section className="panel">
                  <PanelHeader
                    title="Lo próximo en casa"
                    action={
                      <Link
                        href="/calendario"
                        className="icon-button"
                        aria-label="Ver calendario"
                      >
                        <ArrowUpRight size={18} />
                      </Link>
                    }
                  />
                  <div className="upcoming-list">
                    {upcoming
                      .slice(0, 3)
                      .map((event) => renderEventRow({ event: event }))}
                    {!upcoming.length && (
                      <Empty
                        icon={CalendarDays}
                        title="Sin prisa, sin planes"
                        text="Añadid algo al calendario cuando queráis."
                      />
                    )}
                  </div>
                </section>
                <section className="panel bulletin-preview">
                  <PanelHeader
                    title="Se dice por casa"
                    action={
                      <Link
                        href="/tablon"
                        className="icon-button"
                        aria-label="Ver tablón"
                      >
                        <ArrowUpRight size={18} />
                      </Link>
                    }
                  />
                  {announcements
                    .slice(0, 2)
                    .map((item) =>
                      renderAnnouncementCard({ item, compact: true }),
                    )}
                  {!announcements.length && (
                    <p className="empty-inline">
                      Un buen lugar para empezar una conversación.
                    </p>
                  )}
                  <button
                    className="bulletin-write"
                    onClick={() => open({ kind: "announcement" })}
                  >
                    <Plus size={15} />
                    Dejar un mensaje
                  </button>
                </section>
                <div className="soft-note">
                  <House size={21} strokeWidth={1.4} />
                  <p>
                    Una casa funciona mejor
                    <br />
                    <strong>cuando la cuidamos entre todos.</strong>
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
        {view === "gastos" && (
          <>
            <div className="page-heading">
              <div>
                <div className="greeting">LAS CUENTAS, CLARAS</div>
                <h1>Compartir sin complicarse.</h1>
                <p>Cada gasto en su sitio. Cada persona con su parte.</p>
              </div>
              <Button
                onClick={() => open({ kind: "expense" })}
                disabled={!admin && month !== currentMonth()}
              >
                <Plus size={17} />
                Añadir gasto
              </Button>
            </div>
            <div className="section-toolbar">
              {monthPicker}
              <span className="due-date">
                <Clock3 size={14} />
                Vence el {dateLabel(monthEnd(month))}
              </span>
            </div>
            <div className="summary-grid">
              <Metric
                label="Total del mes"
                value={euros(total)}
                icon={Wallet}
                footer={`${expenses.length} gastos en este tablero`}
                accent
              />
              <Metric
                label="Tu parte"
                value={euros(mine.share)}
                icon={Users}
                footer={`Has adelantado ${euros(mine.advanced)}`}
              />
              <Metric
                label={
                  admin
                    ? "Pendiente por cobrar"
                    : mine.pending < 0
                      ? "Te toca recibir"
                      : "Te toca pagar"
                }
                value={euros(admin ? toCollect : Math.abs(mine.pending))}
                icon={ArrowDownLeft}
                footer={
                  admin
                    ? `${euros(toReturn)} pendientes de devolución`
                    : "Después de adelantos y pagos"
                }
                action={
                  !admin && mine.sharedPending > 0 ? (
                    <button
                      className="text-link"
                      onClick={() => open({ kind: "payment", memberId })}
                    >
                      He pagado <ArrowRight size={14} />
                    </button>
                  ) : undefined
                }
              />
            </div>
            {!!pastDue.length && (
              <details className="past-due">
                <summary>
                  <AlertCircle size={16} />
                  {pastDue.length}{" "}
                  {pastDue.length === 1
                    ? "saldo pendiente de meses anteriores"
                    : "saldos pendientes de meses anteriores"}
                  <ChevronRight size={16} />
                </summary>
                {pastDue.map((b) => (
                  <div key={`${b.month}-${b.memberId}`}>
                    <Link href={`/gastos?month=${b.month}`}>
                      {monthLabel(b.month)} · {person(b.memberId).name}
                    </Link>
                    <span>
                      {euros(Math.abs(b.pending))} por{" "}
                      {b.pending < 0 ? "recibir" : "pagar"}
                    </span>
                    {(admin || b.sharedPending > 0) &&
                      b.sharedPending !== 0 && (
                        <button
                          className="text-link"
                          onClick={() =>
                            open({
                              kind: "payment",
                              memberId: b.memberId,
                              month: b.month,
                            })
                          }
                        >
                          Registrar
                        </button>
                      )}
                  </div>
                ))}
              </details>
            )}
            <div className="expenses-layout">
              <div>
                <section className="panel">
                  <PanelHeader
                    title="Gastos compartidos"
                    action={
                      <span className="tag">{expenses.length} gastos</span>
                    }
                  />
                  <div className="expense-filters">
                    <div className="search-input">
                      <Search size={16} />
                      <input
                        aria-label="Buscar gastos"
                        placeholder="Buscar un gasto…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <select
                      aria-label="Filtrar por categoría"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="all">Todas las categorías</option>
                      {state.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {renderExpenseRows({
                    full: true,
                    items: expenses.filter(
                      (e) =>
                        e.title.toLowerCase().includes(search.toLowerCase()) &&
                        (category === "all" || e.categoryId === category),
                    ),
                  })}
                </section>
                <section className="panel comments-panel">
                  <PanelHeader
                    title="Hablemos de las cuentas"
                    subtitle="Comentarios de este mes"
                    action={<MessageCircle size={19} />}
                  />
                  <div className="comment-list">
                    {state.comments
                      .filter((c) => c.month === month)
                      .map((c) => (
                        <article className="comment" key={c.id}>
                          <Avatar
                            name={person(c.authorId).name}
                            index={person(c.authorId).avatar}
                            size={32}
                          />
                          <div>
                            <strong>
                              {person(c.authorId).name}
                              <span>{dateLabel(c.createdAt)}</span>
                            </strong>
                            <p>{c.body}</p>
                          </div>
                          {canEdit(c.authorId) && (
                            <button
                              className="icon-button"
                              aria-label="Eliminar comentario"
                              onClick={() =>
                                run({ type: "comment.delete", id: c.id }, false)
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </article>
                      ))}
                    {!state.comments.some((c) => c.month === month) && (
                      <p className="empty-inline">
                        Una duda, una aclaración… Este es el lugar.
                      </p>
                    )}
                  </div>
                  <form
                    className="comment-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      if (
                        await run(
                          {
                            type: "comment.add",
                            month,
                            body: new FormData(form).get("body"),
                          },
                          false,
                        )
                      )
                        form.reset();
                    }}
                  >
                    <input
                      name="body"
                      aria-label="Comentario del mes"
                      placeholder="Deja un comentario…"
                      required
                      maxLength={2000}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={pending || !state.boards.includes(month)}
                      aria-label="Publicar comentario"
                    >
                      <ArrowUpRight size={18} />
                    </Button>
                  </form>
                </section>
                <section className="panel chart-panel">
                  <PanelHeader
                    title="Un año de vida compartida"
                    subtitle="Gasto mensual por categoría"
                  />
                  <ExpenseChart detailed state={state} month={month} />
                </section>
              </div>
              <aside>
                <section className="panel">
                  <PanelHeader
                    title="El reparto"
                    subtitle="Lo que corresponde a cada uno"
                    action={
                      admin ? (
                        <button
                          className="icon-button"
                          aria-label="Registrar un pago"
                          onClick={() => open({ kind: "payment" })}
                        >
                          <Plus size={18} />
                        </button>
                      ) : undefined
                    }
                  />
                  {renderBalanceTable()}
                  <div className="panel-footer">
                    Los pagos se hacen al administrador.
                  </div>
                </section>
                <section className="panel payments-panel">
                  <PanelHeader title="Pagos registrados" />
                  {state.payments.filter((p) => p.month === month).length ? (
                    [...state.payments]
                      .filter((p) => p.month === month)
                      .reverse()
                      .map((p) => (
                        <div
                          className={`payment-row ${p.voidedAt ? "voided" : ""}`}
                          key={p.id}
                        >
                          <span
                            className={`payment-icon ${p.direction === "from_admin" ? "return" : ""}`}
                          >
                            {p.direction === "to_admin" ? (
                              <ArrowDownLeft size={18} />
                            ) : (
                              <ArrowUpRight size={18} />
                            )}
                          </span>
                          <div>
                            <strong>{person(p.memberId).name}</strong>
                            <span>
                              {p.voidedAt
                                ? "Anulado"
                                : p.direction === "to_admin"
                                  ? "Pago al admin"
                                  : "Devolución"}{" "}
                              ·{" "}
                              {p.purpose === "rent"
                                ? "Alquiler"
                                : p.purpose === "shared"
                                  ? "Gastos comunes"
                                  : "Pago general"}{" "}
                              · {dateLabel(p.createdAt)}
                            </span>
                            <small>Por {person(p.authorId).name}</small>
                          </div>
                          <strong>{euros(p.amount)}</strong>
                          {admin && !p.voidedAt && (
                            <button
                              className="icon-button"
                              aria-label="Anular pago"
                              onClick={() => {
                                if (
                                  confirm(
                                    "¿Anular este movimiento? Quedará visible en el historial.",
                                  )
                                )
                                  void run(
                                    { type: "payment.void", id: p.id },
                                    false,
                                  );
                              }}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))
                  ) : (
                    <p className="empty-inline">Los pagos aparecerán aquí.</p>
                  )}
                </section>
                <section className="panel payments-panel">
                  <PanelHeader
                    title="Pagos por validar"
                    subtitle="Una declaración no modifica el saldo hasta que el administrador la aprueba"
                  />
                  {(state.paymentClaims ?? []).filter((c) => c.month === month)
                    .length ? (
                    (state.paymentClaims ?? [])
                      .filter((c) => c.month === month)
                      .map((c) => (
                        <div className="payment-row" key={c.id}>
                          <div>
                            <strong>
                              {person(c.memberId).name} · {euros(c.amount)}
                            </strong>
                            <span>
                              Gastos comunes{" "}
                              ·{" "}
                              {c.status === "pending"
                                ? "Pendiente"
                                : c.status === "approved"
                                  ? "Validado"
                                  : "Rechazado"}
                            </span>
                          </div>
                          {admin && c.status === "pending" && (
                            <div className="row-actions">
                              <button
                                className="text-link"
                                onClick={() =>
                                  void run(
                                    {
                                      type: "payment.claim.resolve",
                                      id: c.id,
                                      approved: true,
                                    },
                                    false,
                                  )
                                }
                              >
                                Validar
                              </button>
                              <button
                                className="text-link"
                                onClick={() =>
                                  void run(
                                    {
                                      type: "payment.claim.resolve",
                                      id: c.id,
                                      approved: false,
                                    },
                                    false,
                                  )
                                }
                              >
                                Rechazar
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                  ) : (
                    <p className="empty-inline">No hay pagos por validar.</p>
                  )}
                </section>
                <section className="panel payments-panel">
                  <PanelHeader
                    title="Reembolsos por adelantos"
                    subtitle="Transferencias del administrador a quien pagó un recibo"
                  />
                  {expenses
                    .filter(
                      (e) =>
                        (e.settlementMode ?? "credit") === "reimburse" &&
                        e.payerId !==
                          state.members.find((m) => m.role === "admin")?.id &&
                        (admin || e.payerId === memberId),
                    )
                    .map((e) => {
                      const due = reimbursementDue(state, e.id);
                      return (
                        <div className="payment-row" key={e.id}>
                          <div>
                            <strong>{e.title}</strong>
                            <span>
                              {person(e.payerId).name} · Pendiente:{" "}
                              {euros(Math.max(0, due))}
                            </span>
                          </div>
                          {admin && due > 0 && (
                            <button
                              className="text-link"
                              onClick={() =>
                                void run(
                                  {
                                    type: "reimbursement.add",
                                    expenseId: e.id,
                                    amount: (due / 100).toFixed(2),
                                  },
                                  false,
                                )
                              }
                            >
                              Registrar transferencia
                            </button>
                          )}
                        </div>
                      );
                    })}
                  {(state.reimbursements ?? [])
                    .filter((r) => expenses.some((e) => e.id === r.expenseId))
                    .map((r) => (
                      <div className="payment-row" key={r.id}>
                        <span>
                          {r.voidedAt ? "Anulado" : "Reembolsado"} ·{" "}
                          {euros(r.amount)}
                        </span>
                        {admin && !r.voidedAt && (
                          <button
                            className="text-link"
                            onClick={() =>
                              void run(
                                { type: "reimbursement.void", id: r.id },
                                false,
                              )
                            }
                          >
                            Anular
                          </button>
                        )}
                      </div>
                    ))}
                </section>
                <details className="audit-log">
                  <summary>Actividad del mes</summary>
                  {state.audit
                    .filter((a) => a.month === month)
                    .reverse()
                    .slice(0, 30)
                    .map((a) => (
                      <p key={a.id}>
                        <strong>{person(a.authorId)?.name}</strong> ·{" "}
                        {(
                          {
                            "expense.save": "Guardó un gasto",
                            "expense.delete": "Eliminó un gasto",
                            "payment.add": "Registró un pago",
                            "payment.void": "Anuló un pago",
                            "comment.add": "Añadió un comentario",
                          } as Record<string, string>
                        )[a.action] ?? a.action}
                        <span>{dateLabel(a.at)}</span>
                      </p>
                    ))}
                </details>
              </aside>
            </div>
            {admin && <SharePanel state={state} month={month} baseUrl={baseUrl} />}
          </>
        )}
        {view === "calendario" && (
          <>
            <div className="page-heading">
              <div>
                <div className="greeting">HACEMOS HUECO PARA TODOS</div>
                <h1>La vida en casa.</h1>
                <p>Planes, ausencias y las cosas que nos toca cuidar.</p>
              </div>
              <div className="heading-actions">
                <Button
                  variant="secondary"
                  onClick={() => open({ kind: "rotation" })}
                >
                  <RefreshCw size={16} />
                  Crear turnos
                </Button>
                <Button onClick={() => open({ kind: "event" })}>
                  <Plus size={17} />
                  Añadir evento
                </Button>
              </div>
            </div>
            <div className="section-toolbar">
              {monthPicker}
              <div className="segmented">
                <button
                  className={calendarMode === "month" ? "selected" : ""}
                  onClick={() => setCalendarMode("month")}
                >
                  Mes
                </button>
                <button
                  className={calendarMode === "agenda" ? "selected" : ""}
                  onClick={() => setCalendarMode("agenda")}
                >
                  Agenda
                </button>
              </div>
            </div>
            <div className="calendar-filters">
              <button
                className={calendarFilter === "all" ? "selected" : ""}
                onClick={() => setCalendarFilter("all")}
              >
                Todos
              </button>
              {state.calendars.map((c) => (
                <div className="calendar-filter-item" key={c.id}>
                  <button
                    className={calendarFilter === c.id ? "selected" : ""}
                    onClick={() => setCalendarFilter(c.id)}
                  >
                    <i style={{ background: c.color }} />
                    {c.name}
                  </button>
                  {canEdit(c.authorId) && (
                    <button
                      className="icon-button"
                      aria-label={`Editar calendario ${c.name}`}
                      onClick={() => open({ kind: "calendar", item: c })}
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => open({ kind: "calendar" })}>
                <Plus size={14} />
                Calendario
              </button>
            </div>
            {calendarMode === "month" && (
              <section className="calendar-panel panel">
                <div className="calendar-weekdays">
                  {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(
                    (d) => (
                      <span key={d}>{d}</span>
                    ),
                  )}
                </div>
                <div className="calendar-grid">
                  {Array.from({ length: 42 }, (_, i) => {
                    const dayOfWeek = new Date(
                        `${month}-01T12:00:00Z`,
                      ).getUTCDay(),
                      date = addDays(`${month}-01`, i - ((dayOfWeek + 6) % 7));
                    const events = state.events.filter(
                      (e) =>
                        !e.deleted &&
                        e.start.slice(0, 10) <= date &&
                        e.end.slice(0, 10) >= date &&
                        (calendarFilter === "all" ||
                          e.calendarId === calendarFilter),
                    );
                    return (
                      <div
                        key={date}
                        className={`calendar-cell ${date.slice(0, 7) !== month ? "outside" : ""} ${date === today() ? "today" : ""}`}
                      >
                        <button
                          className="calendar-day"
                          aria-label={`Añadir evento el ${date}`}
                          onClick={() => open({ kind: "event", date })}
                        >
                          {Number(date.slice(-2))}
                        </button>
                        {events.slice(0, 3).map((e) => (
                          <button
                            key={e.id}
                            title={`${e.title}${e.assigneeId ? ` · ${person(e.assigneeId).name}` : ""}`}
                            className={`calendar-chip ${e.completed ? "done" : ""}`}
                            style={{
                              background: `${state.calendars.find((c) => c.id === e.calendarId)?.color}18`,
                              color: state.calendars.find(
                                (c) => c.id === e.calendarId,
                              )?.color,
                            }}
                            onClick={() => {
                              if (canEdit(e.authorId))
                                open({ kind: "event", item: e });
                              else {
                                setCalendarMode("agenda");
                              }
                            }}
                          >
                            <i style={{ background: "currentColor" }} />
                            <span>{e.title}</span>
                          </button>
                        ))}
                        {events.length > 3 && (
                          <button
                            className="more-events"
                            onClick={() => setCalendarMode("agenda")}
                          >
                            +{events.length - 3} más
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            <div className="calendar-bottom">
              <section className="panel">
                <PanelHeader
                  title={
                    calendarMode === "agenda"
                      ? "Agenda del mes"
                      : "En vuestro calendario"
                  }
                  subtitle={
                    state.google.calendarId
                      ? `Conectado a ${state.google.calendarName}`
                      : "Un pequeño vistazo a lo que viene"
                  }
                />
                <div className="calendar-agenda">
                  {state.events
                    .filter(
                      (e) =>
                        !e.deleted &&
                        e.start.slice(0, 7) <= month &&
                        e.end.slice(0, 7) >= month &&
                        (calendarFilter === "all" ||
                          e.calendarId === calendarFilter),
                    )
                    .sort((a, b) => a.start.localeCompare(b.start))
                    .map((e) => renderEventRow({ event: e }))}
                  {!state.events.some(
                    (e) =>
                      !e.deleted &&
                      e.start.slice(0, 7) <= month &&
                      e.end.slice(0, 7) >= month &&
                      (calendarFilter === "all" ||
                        e.calendarId === calendarFilter),
                  ) && (
                    <Empty
                      icon={CalendarDays}
                      title="Hay espacio para nuevos planes"
                      text="Añade un evento, una ausencia o una tarea."
                    />
                  )}
                </div>
              </section>
              <section className="panel">
                <PanelHeader
                  title="Los turnos de casa"
                  subtitle="Cada semana, un poquito entre todos"
                />
                {state.rotations
                  .filter((r) => r.active)
                  .map((r) => (
                    <div className="rotation-card" key={r.id}>
                      <div>
                        <span className="category-icon small">
                          <Sparkles size={18} />
                        </span>
                        <strong>{r.title}</strong>
                        {canEdit(r.authorId) && (
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              aria-label={`Editar turnos de ${r.title}`}
                              onClick={() =>
                                open({ kind: "rotation", item: r })
                              }
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Eliminar turnos de ${r.title}`}
                              onClick={() => {
                                if (
                                  confirm(
                                    "¿Detener los turnos futuros? Se conservarán los pasados y completados.",
                                  )
                                )
                                  void run(
                                    { type: "rotation.delete", id: r.id },
                                    false,
                                  );
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                      <p>
                        Cada{" "}
                        {r.everyWeeks === 1
                          ? "semana"
                          : `${r.everyWeeks} semanas`}
                      </p>
                      <div className="rotation-people">
                        {r.memberIds.map((id, i) => (
                          <span key={id}>
                            <Avatar
                              name={person(id).name}
                              index={person(id).avatar}
                              size={27}
                            />
                            <small>{person(id).name}</small>
                            {i < r.memberIds.length - 1 && (
                              <ChevronRight size={12} />
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                {!state.rotations.some((r) => r.active) && (
                  <p className="empty-inline">
                    Repartid las tareas creando vuestro primer turno.
                  </p>
                )}
                <div className="panel-footer">
                  <span>Turnos preparados para los próximos 90 días.</span>
                </div>
              </section>
            </div>
          </>
        )}
        {view === "tablon" && (
          <>
            <div className="page-heading">
              <div>
                <div className="greeting">LAS PEQUEÑAS COSAS IMPORTAN</div>
                <h1>Se dice por casa.</h1>
                <p>
                  Un recordatorio, un plan o simplemente algo que compartir.
                </p>
              </div>
              <Button onClick={() => open({ kind: "announcement" })}>
                <Plus size={17} />
                Dejar un mensaje
              </Button>
            </div>
            <div className="bulletin-banner">
              <MessageCircle size={25} strokeWidth={1.4} />
              <p>
                Como la nota en la nevera.
                <br />
                <strong>Pero sin que se pierda el imán.</strong>
              </p>
              <div className="avatar-stack">
                {active.map((m) => (
                  <Avatar key={m.id} name={m.name} index={m.avatar} size={35} />
                ))}
              </div>
            </div>
            <div className="bulletin-grid">
              {announcements.map((item) => renderAnnouncementCard({ item }))}
            </div>
            {!announcements.length && (
              <Empty
                icon={MessageCircle}
                title="El tablón está esperando vuestra primera nota"
                text="Compartir las pequeñas cosas también es hacer hogar."
              />
            )}
          </>
        )}
        {view === "settings" && (
          <>
            <div className="page-heading">
              <div>
                <div className="greeting">A VUESTRA MANERA</div>
                <h1>Las cosas de casa.</h1>
                <p>Personas, categorías y un poco de organización.</p>
              </div>
              <form action={logout}>
                <Button type="submit" variant="secondary">
                  <LogOut size={16} />
                  Cerrar sesión
                </Button>
              </form>
            </div>
            <div className="settings-layout">
              <div>
                <FinancePanel
                  state={state}
                  memberId={memberId}
                  pending={pending}
                  save={(command) => run(command, false)}
                />
                <section className="panel settings-panel">
                  <PanelHeader title="Nuestra comunidad" />
                  <form
                    className="form-stack"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      await run(
                        {
                          type: "community.save",
                          name: f.get("name"),
                          address: f.get("address"),
                        },
                        false,
                      );
                    }}
                  >
                    <label>
                      Nombre de la casa
                      <input
                        name="name"
                        defaultValue={state.name}
                        disabled={!admin}
                        required
                        maxLength={120}
                      />
                    </label>
                    <label>
                      Una descripción
                      <input
                        name="address"
                        defaultValue={state.address}
                        disabled={!admin}
                        maxLength={150}
                      />
                    </label>
                    {admin && (
                      <Button disabled={pending} type="submit">
                        Guardar comunidad
                      </Button>
                    )}
                  </form>
                </section>
                <section className="panel">
                  <PanelHeader
                    title="Las personas de casa"
                    subtitle="Cada uno con su hueco"
                    action={
                      admin ? (
                        <button
                          className="text-link"
                          onClick={() => open({ kind: "invite" })}
                        >
                          <Plus size={15} />
                          Invitar
                        </button>
                      ) : undefined
                    }
                  />
                  {state.members.map((m) => (
                    <div
                      className={`member-row ${!m.active ? "inactive" : ""}`}
                      key={m.id}
                    >
                      <Avatar name={m.name} index={m.avatar} size={39} />
                      <div>
                        <strong>
                          {m.name}
                          {m.id === memberId ? " (tú)" : ""}
                        </strong>
                        <span>
                          {!m.active
                            ? "Ya no vive aquí"
                            : m.role === "admin"
                              ? "Administrador"
                              : m.role === "guest"
                                ? `Visita · ${monthLabel(m.guestMonth!)}`
                                : m.registered
                                  ? m.googleLinked
                                    ? `Google vinculado${admin && m.googleEmail ? ` · ${m.googleEmail}` : ""}`
                                    : "Compañero de piso"
                                  : "Invitación pendiente"}
                        </span>
                      </div>
                      {admin && m.role !== "admin" && m.active && (
                        <div className="row-actions">
                          {m.role === "member" && !m.googleLinked && (
                            <>
                              <button
                                className="icon-button"
                                aria-label={`Generar enlace para ${m.name}`}
                                onClick={() =>
                                  open({ kind: "invite", memberId: m.id })
                                }
                              >
                                <Link2 size={16} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`Revocar acceso de ${m.name}`}
                                onClick={() => {
                                  if (
                                    confirm(
                                      `¿Revocar el enlace y las sesiones de ${m.name}?`,
                                    )
                                  )
                                    void run(
                                      { type: "member.revoke", id: m.id },
                                      false,
                                    );
                                }}
                              >
                                <ShieldCheck size={16} />
                              </button>
                            </>
                          )}
                          <button
                            className="icon-button danger"
                            aria-label={`Desactivar a ${m.name}`}
                            onClick={() => {
                              if (
                                confirm(
                                  `¿Desactivar a ${m.name}? Sus cuentas anteriores se conservarán.`,
                                )
                              )
                                void run(
                                  { type: "member.deactivate", id: m.id },
                                  false,
                                );
                            }}
                          >
                            <DoorOpen size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {admin && (
                    <button
                      className="bulletin-write"
                      onClick={() => open({ kind: "guest" })}
                    >
                      <Plus size={15} />
                      Añadir una visita temporal
                    </button>
                  )}
                </section>
              </div>
              <div>
                <section className="panel">
                  <PanelHeader
                    title="Categorías de gasto"
                    action={
                      admin ? (
                        <button
                          className="icon-button"
                          aria-label="Añadir categoría"
                          onClick={() => open({ kind: "category" })}
                        >
                          <Plus size={18} />
                        </button>
                      ) : undefined
                    }
                  />
                  {state.categories.map((c) => (
                    <div
                      className={`category-row ${c.archived ? "inactive" : ""}`}
                      key={c.id}
                    >
                      {renderCategoryIcon({ id: c.id, small: true })}
                      <span>
                        {c.name}
                        {c.archived && <small> · Archivada</small>}
                      </span>
                      {admin && (
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            aria-label={`Editar categoría ${c.name}`}
                            onClick={() => open({ kind: "category", item: c })}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="text-link"
                            onClick={() =>
                              run({ type: "category.archive", id: c.id }, false)
                            }
                          >
                            {c.archived ? "Restaurar" : "Archivar"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </section>
                <section className="panel google-panel">
                  <PanelHeader
                    title="Google Calendar"
                    action={<CalendarDays size={20} />}
                  />
                  <p>
                    Vuestros planes, también en el calendario que ya compartís.
                  </p>
                  {googleStatus === "configuration" && (
                    <div className="error-box">
                      Configura las credenciales de Google y la clave de cifrado
                      para conectar el calendario.
                    </div>
                  )}
                  {googleStatus === "error" && (
                    <div className="error-box">
                      No se pudo completar la conexión. Vuelve a intentarlo.
                    </div>
                  )}
                  {state.google.reconnect && (
                    <div className="error-box">
                      Google necesita que vuelvas a autorizar el acceso.
                    </div>
                  )}
                  {state.google.calendarId && (
                    <div className="google-connected">
                      <Check size={17} />
                      <div>
                        <strong>{state.google.calendarName}</strong>
                        <small>
                          {
                            state.events.filter(
                              (e) => e.version !== e.syncedVersion,
                            ).length
                          }{" "}
                          cambios pendientes
                        </small>
                      </div>
                    </div>
                  )}
                  {admin && (
                    <div className="form-stack">
                      {(!state.google.connected || state.google.reconnect) && (
                        <form action="/api/google/connect" method="get">
                          <Button variant="secondary" type="submit">
                            <Link2 size={16} />
                            {state.google.reconnect
                              ? "Reconectar Google"
                              : "Conectar Google Calendar"}
                          </Button>
                        </form>
                      )}
                      {state.google.connected && !state.google.calendarId && (
                        <>
                          <Button
                            variant="secondary"
                            disabled={pending}
                            onClick={async () => {
                              setPending(true);
                              try {
                                const result = await listGoogleCalendars();
                                setGoogleOptions(result.calendars);
                                if (result.error) setError(result.error);
                              } catch {
                                setError(
                                  "No se pudieron cargar los calendarios.",
                                );
                              } finally {
                                setPending(false);
                              }
                            }}
                          >
                            Elegir calendario compartido
                          </Button>
                          {googleOptions.map((c) => (
                            <button
                              className="google-option"
                              key={c.id}
                              onClick={() =>
                                googleAction(() => selectGoogleCalendar(c.id))
                              }
                            >
                              {c.summary}
                              <ArrowRight size={16} />
                            </button>
                          ))}
                        </>
                      )}
                      {state.google.calendarId && (
                        <Button
                          variant="secondary"
                          disabled={pending}
                          onClick={() => googleAction(retryGoogle)}
                        >
                          <RefreshCw size={15} />
                          Reintentar sincronización
                        </Button>
                      )}
                      {state.google.connected && (
                        <button
                          className="text-link"
                          onClick={() => {
                            if (
                              confirm(
                                "¿Desconectar Google? Los eventos que ya se publicaron permanecerán allí.",
                              )
                            )
                              void googleAction(disconnectGoogle);
                          }}
                        >
                          Desconectar
                        </button>
                      )}
                    </div>
                  )}
                  <div className="google-note">
                    <CircleHelp size={15} />
                    <span>
                      Los cambios van de Flat Mate a Google. Los eventos
                      externos no se importan.
                    </span>
                  </div>
                </section>
                <div className="settings-note">
                  <ShieldCheck size={19} />
                  <p>
                    Solo las personas de vuestra comunidad pueden ver estas
                    cuentas.
                    <br />
                    <strong>Español · EUR · Europe/Madrid</strong>
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
        <footer className="page-footer">
          <span>Un hogar se hace entre todos.</span>
          <span>
            flatmate <span className="coral">♥</span>
          </span>
        </footer>
      </main>
      <nav className="mobile-nav" aria-label="Navegación móvil">
        {sections.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className={view === s.id ? "active" : ""}
            aria-current={view === s.id ? "page" : undefined}
          >
            <s.icon size={21} strokeWidth={1.7} />
            <span>{s.label}</span>
          </Link>
        ))}
      </nav>
      {modal && (
        <FormModal
          selection={modal}
          state={state}
          memberId={memberId}
          month={month}
          pending={pending}
          error={error}
          save={run}
          returnFocus={returnFocus}
          close={() => {
            setModal(null);
            setError("");
            router.refresh();
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </>
  );
}
function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function Metric({
  label,
  value,
  footer,
  icon: Icon,
  accent = false,
  trend = false,
  action,
}: {
  label: string;
  value: string;
  footer: string;
  icon: typeof Wallet;
  accent?: boolean;
  trend?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <section className={`metric ${accent ? "metric-accent" : ""}`}>
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={18} strokeWidth={1.6} />
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-bottom">
        <span className={trend ? "green" : ""}>
          {trend && <TrendingDown size={13} />}
          {footer}
        </span>
        {action}
      </div>
    </section>
  );
}
function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Wallet;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <Icon size={27} strokeWidth={1.3} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
