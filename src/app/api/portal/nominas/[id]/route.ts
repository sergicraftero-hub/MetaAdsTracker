import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { toPayslip } from "@/lib/portal";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Descarga de una nómina: solo su dueño o dirección. Notion da enlaces temporales, así que se pide uno nuevo cada vez. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireSession();
  const { id } = await ctx.params;
  const row = await store.rowGet(id);
  const slip = toPayslip(row);
  if (me.role !== "admin" && slip.user !== me.email) throw new HttpError(404, "Nómina no encontrada");
  const url = String(row.ArchivoUrl ?? "");
  if (!url) throw new HttpError(404, "La nómina no tiene archivo");
  return NextResponse.redirect(new URL(url, req.url), 302);
});
