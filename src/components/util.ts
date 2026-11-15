import type { Lead, LeadsPayload, Value } from "@/lib/types";

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Sin conexión");
  }
  if (res.status === 401 && path !== "/api/login") {
    window.location.href = "/login";
    throw new Error("Sesión caducada");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Error del servidor");
  return json as T;
}

export const str = (v: Value | undefined) => (v === null || v === undefined ? "" : String(v));

/** «más_de_70_€» → «más de 70 €» */
export const pretty = (v: Value | undefined) => str(v).replace(/_/g, " ");

export interface When {
  date: Date;
  hasTime: boolean;
}

export function parseWhen(v: Value | undefined): When | null {
  const s = str(v);
  if (!s) return null;
  const hasTime = s.includes("T");
  const date = hasTime ? new Date(s) : new Date(`${s}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : { date, hasTime };
}

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const timeKey = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function dayDiff(d: Date): number {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const n = new Date();
  const b = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return Math.round((a - b) / 86400_000);
}

export function fmtWhen(v: Value | undefined): string {
  const w = parseWhen(v);
  if (!w) return "";
  const diff = dayDiff(w.date);
  const day =
    diff === 0
      ? "Hoy"
      : diff === 1
        ? "Mañana"
        : diff === -1
          ? "Ayer"
          : w.date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  return w.hasTime ? `${day}, ${timeKey(w.date)}` : day;
}

export function fmtAgo(v: Value | undefined): string {
  const w = parseWhen(v);
  if (!w) return "";
  const min = Math.round((Date.now() - w.date.getTime()) / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  if (min < 60 * 24) return `hace ${Math.round(min / 60)} h`;
  const days = Math.round(min / 1440);
  return days < 31 ? `hace ${days} d` : w.date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/** ¿La rellamada toca hoy o ya ha pasado? */
export function isDue(v: Value | undefined): boolean {
  const w = parseWhen(v);
  return !!w && dayDiff(w.date) <= 0;
}

export function digits(phone: Value | undefined): string {
  const d = str(phone).replace(/\D/g, "");
  return d.length === 9 ? `34${d}` : d;
}

export const telHref = (p: Value | undefined) => `tel:+${digits(p)}`;
export const waHref = (p: Value | undefined) => `https://wa.me/${digits(p)}`;

export const entryTime = (l: Lead) => parseWhen(l.f.fecha)?.date.getTime() ?? 0;

export function matches(l: Lead, q: string): boolean {
  if (!q) return true;
  const hay = `${str(l.f.nombre)} ${str(l.f.telefono)} ${str(l.f.email)} ${str(l.f.cp)} ${str(l.f.comentarios)}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

/** Minutos de aviso antes de que acabe la jornada: a partir de ahí no se dan más llamadas. */
export const SHIFT_WARN_MS = 5 * 60_000;

/**
 * Milisegundos que le quedan de jornada a quien usa la app (negativo si ya la ha cumplido).
 * null si no ha fichado o dirección no le ha puesto horas.
 */
export function shiftRemaining(clock: LeadsPayload["clock"], now = Date.now()): number | null {
  if (!clock || !clock.hours) return null;
  const breaks = clock.breaks.reduce((a, b) => a + Math.max(0, (b.e ? new Date(b.e).getTime() : now) - new Date(b.s).getTime()), 0);
  const worked = Math.max(0, now - new Date(clock.start).getTime() - breaks);
  return clock.hours * 3600_000 - worked;
}
