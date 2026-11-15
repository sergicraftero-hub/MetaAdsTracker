import { HttpError } from "./auth";
import type { Bonus, BonusPeriod, CallLog, Session } from "./types";

const NO_CONTACT = new Set(["ILOCALIZABLE", "NUMERO ERRONEO", "SALTADO", ""]);

/** Inicio del periodo en curso (hora de Madrid aproximada con la hora del servidor). */
export function periodStart(period: BonusPeriod, now = new Date()): Date {
  const d = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  const offset = now.getTime() - d.getTime();
  d.setHours(0, 0, 0, 0);
  if (period === "semana") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (period === "mes") d.setDate(1);
  return new Date(d.getTime() + offset);
}

const same = (a: string, b: string) => !!a && a.trim().toLowerCase() === b.trim().toLowerCase();

/** ¿Este bono es para este usuario? Los de equipo son para todos. */
export const isFor = (b: Bonus, me: Session) => !b.para || same(b.para, me.code) || same(b.para, me.name);

/** Lo conseguido en el periodo actual: del equipo entero o solo de la persona del bono. */
export interface FiberSale {
  date: string;
  comercial: string;
  /** Fibra principal, de primera residencia y sin baja: lo único que cuenta para objetivos */
  baf: boolean;
}

/**
 * Lo conseguido en el periodo. Los firmados salen de las contrataciones y solo cuentan las fibras de primera
 * residencia que no se han caído: ni líneas móviles, ni segundas residencias, ni bajas o no instaladas.
 */
export function progress(b: Bonus, log: CallLog[], sales: FiberSale[] = []): number {
  const from = periodStart(b.period).getTime();
  if (b.metric === "firmados") {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date(from));
    return sales.filter((s) => s.baf && s.date >= day && (!b.para || same(b.para, s.comercial))).length;
  }
  return log.filter((r) => {
    if (new Date(r.at).getTime() < from || r.result === "SALTADO") return false;
    if (b.para && !same(b.para, r.code) && !same(b.para, r.user)) return false;
    if (b.metric === "contactos") return !NO_CONTACT.has(r.result.toUpperCase());
    return true;
  }).length;
}

/** Valida lo que envía dirección al crear o editar un bono. */
export function cleanBonus(input: Record<string, unknown>, creating: boolean): Partial<Bonus> {
  const out: Partial<Bonus> = {};
  if (typeof input.title === "string") out.title = input.title.trim().slice(0, 120);
  if (typeof input.prize === "string") out.prize = input.prize.trim().slice(0, 200);
  if (input.metric === "firmados" || input.metric === "llamadas" || input.metric === "contactos") out.metric = input.metric;
  if (input.period === "dia" || input.period === "semana" || input.period === "mes") out.period = input.period;
  if (input.goal !== undefined) {
    const n = Math.round(Number(input.goal));
    if (!Number.isFinite(n) || n < 1 || n > 100000) throw new HttpError(400, "La meta debe ser un número mayor que cero");
    out.goal = n;
  }
  if (typeof input.para === "string") out.para = input.para.trim().slice(0, 80);
  if (typeof input.active === "boolean") out.active = input.active;
  if (creating) {
    if (!out.title) throw new HttpError(400, "Ponle un nombre al bono");
    if (!out.goal) throw new HttpError(400, "Indica la meta del bono");
    return { prize: "", metric: "firmados", period: "semana", para: "", active: true, ...out };
  }
  return out;
}
