import { HttpError, seal } from "./auth";
import type { Row } from "./notion";
import { store } from "./store";
import type { Leave, LeaveStatus, Payslip, Person, Session, Shift } from "./types";

export const LEAVE_TYPES = ["Vacaciones", "Asunto propio", "Baja médica", "Corrección de fichaje", "Otro"];

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/* ---------- Fichajes ---------- */

function parseBreaks(raw: unknown): Shift["breaks"] {
  try {
    const list = JSON.parse(str(raw) || "[]");
    return Array.isArray(list) ? list.filter((b) => b && typeof b.s === "string").map((b) => ({ s: b.s, e: typeof b.e === "string" ? b.e : null })) : [];
  } catch {
    return [];
  }
}

const iso = (v: unknown) => (str(v) ? new Date(str(v)).toISOString() : "");
/** Lo que se firma de cada jornada: si cambia fuera de la app, la firma deja de coincidir. */
const payload = (user: string, start: string, end: string | null, breaks: Shift["breaks"]) => `${user}|${iso(start)}|${end ? iso(end) : ""}|${JSON.stringify(breaks)}`;

export function toShift(r: Row): Shift {
  const user = str(r.Usuario);
  const start = str(r.Entrada);
  const end = str(r.Salida) || null;
  const breaks = parseBreaks(r.Descansos);
  return { id: r.id, user, name: str(r.Nombre), start, end, breaks, edits: str(r.Correcciones), valid: str(r.Firma) === seal(payload(user, start, end, breaks)) };
}

/** Valores de las columnas de Notion para guardar una jornada, con su firma. */
export function shiftValues(user: string, start: string, end: string | null, breaks: Shift["breaks"]) {
  return { Entrada: start, Salida: end, Descansos: JSON.stringify(breaks), Firma: seal(payload(user, start, end, breaks)) };
}

/** Jornada abierta (sin salida) de un trabajador, si la hay. */
export async function openShift(user: string): Promise<Shift | null> {
  const rows = await store.rowsList("fichajes", { and: [{ property: "Usuario", rich_text: { equals: user } }, { property: "Salida", date: { is_empty: true } }] });
  const open = rows.map(toShift).filter((s) => s.user === user && !s.end).sort((a, b) => b.start.localeCompare(a.start));
  return open[0] ?? null;
}

/** Jornadas que empezaron en un mes (YYYY-MM), en horario de Madrid. */
export async function monthShifts(month: string): Promise<Shift[]> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpError(400, "Mes no válido");
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1) - 3 * 3600_000).toISOString();
  const to = new Date(Date.UTC(y, m, 1) + 3 * 3600_000).toISOString();
  const rows = await store.rowsList("fichajes", { and: [{ property: "Entrada", date: { on_or_after: from } }, { property: "Entrada", date: { before: to } }] });
  return rows
    .map(toShift)
    .filter((s) => s.start && madridDate(s.start).startsWith(month))
    .sort((a, b) => a.start.localeCompare(b.start));
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", ...opts });
export const madridDate = (v: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date(v));
export const madridTime = (v: string) => fmt({ hour: "2-digit", minute: "2-digit" }).format(new Date(v));

export function breakMs(s: Shift, now = Date.now()): number {
  return s.breaks.reduce((a, b) => a + Math.max(0, (b.e ? new Date(b.e).getTime() : now) - new Date(b.s).getTime()), 0);
}
export function workedMs(s: Shift, now = Date.now()): number {
  return Math.max(0, (s.end ? new Date(s.end).getTime() : now) - new Date(s.start).getTime() - breakMs(s, now));
}

/* ---------- Solicitudes ---------- */

export function toLeave(r: Row): Leave {
  const status = str(r.Estado);
  return {
    id: r.id,
    user: str(r.Usuario),
    name: str(r.Nombre),
    type: str(r.Tipo) || "Otro",
    from: str(r.Desde).slice(0, 10),
    to: (str(r.Hasta) || str(r.Desde)).slice(0, 10),
    status: (status === "aprobada" || status === "rechazada" ? status : "pendiente") as LeaveStatus,
    note: str(r.Nota),
    resolved: str(r.Resuelto),
    created: r.created,
  };
}

export const toPayslip = (r: Row): Payslip => ({ id: r.id, user: str(r.Usuario), name: str(r.Nombre), period: str(r.Periodo), file: str(r.Archivo) });

/** Trabajadores: los usuarios activos y, si no está entre ellos, quien pregunta (el administrador inicial). */
export async function people(me: Session): Promise<Person[]> {
  const users = (await store.listUsers().catch(() => [])).filter((u) => u.active).map((u) => ({ email: u.email, name: u.name }));
  if (!users.some((u) => u.email === me.email)) users.unshift({ email: me.email, name: me.name });
  return users.sort((a, b) => a.name.localeCompare(b.name));
}
