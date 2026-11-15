import { NextResponse } from "next/server";
import { handle, requireSession } from "@/lib/auth";
import { applyLostRule, attemptFields, cleanFields, visibleLead } from "@/lib/leadRules";
import { store } from "@/lib/store";

/** Registra un intento de contacto: hora, contador, primer contacto y (opcional) estado y rellamada. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireSession();
  const { id } = await ctx.params;
  const current = await visibleLead(me, id);
  const body = (await req.json().catch(() => ({}))) as { fields?: Record<string, unknown> };
  const extra = cleanFields(body.fields ?? {}, me, current);
  const schema = await store.getSchema();
  const fields = applyLostRule({ ...attemptFields(current, me, schema), ...extra }, current);
  const lead = await store.updateLead(id, fields);
  // Los intentos apuntados a mano desde la ficha también quedan en el registro de llamadas
  await store
    .addLog({ at: new Date().toISOString(), user: me.name, code: me.code, leadId: id, leadName: String(current.f.nombre ?? ""), source: "ficha", result: String(lead.f.estado ?? ""), seconds: 0, called: false, away: 0, phone: String(current.f.telefono ?? "") })
    .catch((e) => console.error("No se pudo registrar el intento", e));
  return NextResponse.json({ lead });
});
