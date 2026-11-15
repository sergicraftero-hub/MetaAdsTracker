import { NextResponse } from "next/server";
import { handle, requireSession } from "@/lib/auth";
import { stageOf } from "@/lib/fields";
import { attemptFields, cleanFields, visibleLead } from "@/lib/leadRules";
import { store } from "@/lib/store";

interface Body {
  fields?: Record<string, unknown>;
  shownAt?: string;
  called?: boolean;
  source?: string;
  skipped?: boolean;
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
    // Al firmar, el lead entra en el seguimiento de contratos
    if (stageOf(fields.estado) === "ganado" && !current.f.estadoContrato && schema.estadoContrato.options?.some((o) => o.name === "FIRMADO")) {
      fields.estadoContrato = "FIRMADO";
    }
    lead = await store.updateLead(id, fields);
  }

  const shown = new Date(body.shownAt ?? "");
  const at = Number.isNaN(shown.getTime()) || shown.getTime() > Date.now() ? new Date() : shown;
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
    });
    logged = !!entry;
  } catch (e) {
    console.error("No se pudo registrar la llamada", e);
    logged = false;
  }
  return NextResponse.json({ lead, logged });
});
