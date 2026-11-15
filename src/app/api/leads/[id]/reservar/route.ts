import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { canSee } from "@/lib/fields";
import { forUser, visibleLead } from "@/lib/leadRules";
import { store, unassignedVisible } from "@/lib/store";
import { working } from "@/lib/working";

/**
 * El modo «Llamar» reserva el lead antes de enseñarlo: mientras alguien lo tiene en pantalla,
 * no le sale a nadie más. Así dos personas no llaman al mismo.
 */
export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireSession();
  const { id } = await ctx.params;
  const w = await working();
  // Los comerciales solo entran en el reparto de llamadas mientras tienen la jornada abierta
  if (me.role !== "admin" && w.ready && !w.emails.has(me.email)) throw new HttpError(403, "Ficha la entrada en el Portal para empezar a llamar");
  const cached = await visibleLead(me, id);
  // Primero la reserva: si otra persona (comercial o dirección) lo tiene en pantalla, no se le enseña a nadie más
  if (!(await store.lockLead(id, String(cached.f.nombre ?? ""), me.email))) throw new HttpError(409, "Otra persona está llamando a este lead");
  const fresh = await store.refreshLead(id);
  if (!fresh || !canSee(me, fresh, unassignedVisible(), w.ready ? w.codes : null)) {
    await store.unlockLead(id, me.email).catch(() => {});
    throw new HttpError(409, "Otro comercial ya tiene este lead");
  }
  // Reservar no asigna: el lead pasa a ser de quien llama cuando pulsa «Llamar» o guarda el resultado.
  // `edited` sirve al cliente para saber si alguien lo acaba de llamar.
  return NextResponse.json({ lead: forUser(me, fresh), edited: fresh.edited });
});
