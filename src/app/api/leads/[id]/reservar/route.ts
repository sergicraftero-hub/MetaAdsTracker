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
  const cached = await visibleLead(me, id);
  // Primero la reserva: si otra persona (comercial o dirección) lo tiene en pantalla, no se le enseña a nadie más
  if (!(await store.lockLead(id, String(cached.f.nombre ?? ""), me.email))) throw new HttpError(409, "Otra persona está llamando a este lead");
  const fresh = await store.refreshLead(id);
  if (!fresh || !canSee(me, fresh, unassignedVisible())) {
    await store.unlockLead(id, me.email).catch(() => {});
    throw new HttpError(409, "Otro comercial ya tiene este lead");
  }
  // `edited` es la última modificación antes de esta reserva: el cliente la usa para saber si alguien lo acaba de llamar
  const edited = fresh.edited;
  if (!fresh.f.comercial && me.code) {
    return NextResponse.json({ lead: await store.updateLead(id, { comercial: me.code }), edited });
  }
  return NextResponse.json({ lead: fresh, edited });
});
