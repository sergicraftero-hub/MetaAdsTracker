import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { canSee } from "@/lib/fields";
import { visibleLead } from "@/lib/leadRules";
import { store, unassignedVisible } from "@/lib/store";

/**
 * El modo «Llamar» reserva el lead antes de enseñarlo: lo lee de Notion sin caché y,
 * si no tiene comercial, se lo asigna a quien lo va a llamar. Así dos personas no llaman al mismo.
 */
export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireSession();
  const { id } = await ctx.params;
  await visibleLead(me, id);
  const fresh = await store.refreshLead(id);
  if (!fresh || !canSee(me, fresh, unassignedVisible())) throw new HttpError(409, "Otro comercial ya tiene este lead");
  if (!fresh.f.comercial && me.code) {
    return NextResponse.json({ lead: await store.updateLead(id, { comercial: me.code }) });
  }
  return NextResponse.json({ lead: fresh });
});
