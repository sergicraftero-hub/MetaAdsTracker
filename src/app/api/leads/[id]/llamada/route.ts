import { NextResponse } from "next/server";
import { handle, requireSession } from "@/lib/auth";
import { stageOf } from "@/lib/fields";
import { applyLostRule, attemptFields, cleanFields, forUser, visibleLead } from "@/lib/leadRules";
import { store } from "@/lib/store";

interface Body {
  fields?: Record<string, unknown>;
  shownAt?: string;
  called?: boolean;
  source?: string;
  skipped?: boolean;
  /** Segundos fuera de la app tras pulsar Llamar (medidos en el móvil) */
  away?: number;
}

/** Resultado de una llamada del modo «Llamar»: actualiza el lead y deja constancia en el registro. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireSession();
  const { id } = await ctx.params;
  const current = await visibleLead(me, id);
  const body = (await req.json().catch(() => ({}))) as Body;
  const schema = await store.getSchema();

  let lead = current;
  if (!body.skipped) {
    const extra = cleanFields(body.fields ?? {}, me, current);
    const fields = { ...attemptFields(current, me, schema), ...extra };
    // Quien consigue hablar con un lead que su comercial no había logrado contactar se lo queda
    const uncontacted = stageOf(current.f.estado) === "nuevo" || String(current.f.estado).toUpperCase() === "ILOCALIZABLE";
    if (me.code && current.f.comercial && current.f.comercial !== me.code && uncontacted) fields.comercial = me.code;
    // Al firmar, el lead entra en el seguimiento de contratos
    if (stageOf(fields.estado) === "ganado" && !current.f.estadoContrato && schema.estadoContrato.options?.some((o) => o.name === "FIRMADO")) {
      fields.estadoContrato = "FIRMADO";
    }
    lead = await store.updateLead(id, applyLostRule(fields, current));
  }

  const shown = new Date(body.shownAt ?? "");
  const at = Number.isNaN(shown.getTime()) || shown.getTime() > Date.now() ? new Date() : shown;
  // Duración real aproximada: la mide el propio móvil; si la llamada se pidió desde el ordenador, la apuntó el móvil en el aviso
  let away = Math.min(Math.max(Math.round(Number(body.away) || 0), 0), 4 * 3600);
  if (!away && body.called && !body.skipped) away = await store.takeAlertAway(me.email, id).catch(() => 0);
  let logged = true;
  try {
    const entry = await store.addLog({
      at: at.toISOString(),
      user: me.name,
      code: me.code,
      leadId: id,
      leadName: String(current.f.nombre ?? ""),
      source: String(body.source ?? "").slice(0, 30),
      result: body.skipped ? "SALTADO" : String(lead.f.estado ?? ""),
      seconds: Math.min(Math.max(Math.round((Date.now() - at.getTime()) / 1000), 0), 4 * 3600),
      called: body.called === true,
      away,
      phone: String(current.f.telefono ?? ""),
    });
    logged = !!entry;
  } catch (e) {
    console.error("No se pudo registrar la llamada", e);
    logged = false;
  }
  await store.unlockLead(id, me.email).catch(() => {});
  return NextResponse.json({ lead: forUser(me, lead), logged });
});
