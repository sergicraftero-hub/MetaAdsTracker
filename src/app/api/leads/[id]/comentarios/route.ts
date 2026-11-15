import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { visibleLead } from "@/lib/leadRules";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
const MAX = 4 * 1024 * 1024;

/** Notas del lead: son los comentarios de su página en Notion. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireSession();
  const { id } = await ctx.params;
  await visibleLead(me, id);
  return NextResponse.json({ comments: await store.listComments(id) });
});

/** Añade una nota, con un archivo opcional (el contrato). El nombre de quien escribe va delante del texto. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireSession();
  const { id } = await ctx.params;
  await visibleLead(me, id);
  const form = await req.formData().catch(() => null);
  const text = String(form?.get("text") ?? "").trim().slice(0, 4000);
  const file = form?.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (!text && !hasFile) throw new HttpError(400, "Escribe una nota o adjunta un archivo");
  if (hasFile && file.size > MAX) throw new HttpError(413, "El archivo supera los 4 MB");
  const who = me.code || me.name;
  await store.addComment(id, `${who}: ${text || "archivo adjunto"}`, hasFile ? file : undefined);
  return NextResponse.json({ comments: await store.listComments(id) });
});
