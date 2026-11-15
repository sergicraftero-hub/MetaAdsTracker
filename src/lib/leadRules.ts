import { HttpError } from "./auth";
import { LOST_STATE, MAX_ATTEMPTS, canSee } from "./fields";
import { store, unassignedVisible } from "./store";
import { working } from "./working";
import { FIELD_KEYS } from "./types";
import type { FieldKey, Fields, Lead, Schema, Session, Value } from "./types";

const KEYS = new Set<string>(FIELD_KEYS);

export async function visibleLead(me: Session, id: string): Promise<Lead> {
  const lead = await store.getLead(id);
  const w = me.role === "admin" ? null : await working();
  if (!lead || !canSee(me, lead, unassignedVisible(), w?.ready ? w.codes : null)) throw new HttpError(404, "Lead no encontrado");
  return lead;
}

/** Valida los campos que llegan del cliente y aplica los permisos del rol. */
export function cleanFields(input: Record<string, unknown>, me: Session, current: Lead | undefined): Partial<Fields> {
  const out: Partial<Fields> = {};
  for (const [k, v] of Object.entries(input)) {
    if (!KEYS.has(k)) continue;
    if (v !== null && !["string", "number", "boolean"].includes(typeof v)) continue;
    if (typeof v === "string" && v.length > 5000) throw new HttpError(400, "Texto demasiado largo");
    out[k as FieldKey] = (typeof v === "string" ? v.trim() || null : v) as Value;
  }
  if (me.role !== "admin") {
    delete out.fecha;
    if ("comercial" in out) {
      const owner = String(current?.f.comercial ?? "");
      // Un comercial solo puede quedarse un lead sin asignar; no reasignarlo a otra persona
      if (!me.code || out.comercial !== me.code || (owner && owner !== me.code)) {
        throw new HttpError(403, "Solo dirección puede reasignar leads");
      }
    }
  }
  return out;
}

/**
 * Al quinto intento sin haber localizado al lead, pasa a «PERDIDO»: la cola no lo vuelve a sacar
 * y solo se recupera cambiándole el estado desde la pestaña Leads.
 */
export function applyLostRule(fields: Partial<Fields>, current: Lead): Partial<Fields> {
  const attempts = typeof fields.intentos === "number" ? fields.intentos : 0;
  const estado = String(("estado" in fields ? fields.estado : current.f.estado) ?? "").toUpperCase();
  if (attempts >= MAX_ATTEMPTS && (!estado || estado === "ILOCALIZABLE")) return { ...fields, estado: LOST_STATE, rellamada: null };
  return fields;
}

const madrid = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", ...opts }).formatToParts(new Date());
const part = (ps: Intl.DateTimeFormatPart[], t: string) => ps.find((p) => p.type === t)?.value ?? "";

/** Campos que cambia el registro de un intento de llamada. */
export function attemptFields(lead: Lead, me: Session, schema: Schema): Partial<Fields> {
  const ps = madrid({ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const stamp = `${part(ps, "day")}/${part(ps, "month")} ${part(ps, "hour")}:${part(ps, "minute")}`;
  const today = `${part(ps, "year")}-${part(ps, "month")}-${part(ps, "day")}`;
  const slots: FieldKey[] = ["intento1", "intento2", "intento3"];
  const filled = slots.filter((s) => lead.f[s]).length;
  const out: Partial<Fields> = {};
  const free = slots.find((s) => !lead.f[s]);
  if (free) out[free] = stamp;
  else out.intento3 = `${lead.f.intento3} · ${stamp}`;
  if (schema.intentos.type !== "missing") {
    out.intentos = (typeof lead.f.intentos === "number" ? lead.f.intentos : filled) + 1;
  }
  if (!lead.f.fechaContacto) out.fechaContacto = today;
  if (!lead.f.comercial && me.code) out.comercial = me.code;
  return out;
}

/** El lead tal como se le envía a este usuario: el enlace a Notion solo va a dirección. */
export const forUser = (me: Session, lead: Lead): Lead => (me.role === "admin" ? lead : { ...lead, url: undefined });
