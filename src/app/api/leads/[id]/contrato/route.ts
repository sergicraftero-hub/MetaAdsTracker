import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { visibleLead } from "@/lib/leadRules";
import { store } from "@/lib/store";

const MAX = 4 * 1024 * 1024;

/** Adjunta el contrato firmado al lead (columna CONTRATO de Notion). */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireSession();
  const { id } = await ctx.params;
  await visibleLead(me, id);
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File) || !file.size) throw new HttpError(400, "No se ha recibido ningún archivo");
  if (file.size > MAX) throw new HttpError(413, "El archivo supera los 4 MB");
  return NextResponse.json({ lead: await store.attachContract(id, file) });
});
