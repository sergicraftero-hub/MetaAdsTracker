import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { store } from "@/lib/store";

/** Dirección envía un aviso de texto a todo el equipo (aparece en la campana de todos). */
export const POST = handle(async (req: Request) => {
  const me = await requireSession(true);
  if (!(await store.portalReady())) throw new HttpError(400, "Falta la página «BUT Calls» en Notion");
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const clean = String(text ?? "").trim().slice(0, 500);
  if (clean.length < 2) throw new HttpError(400, "Escribe el mensaje del aviso");
  await store.rowAdd("anuncios", { Aviso: clean, Autor: me.name });
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  await requireSession(true);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!(await store.rowsList("anuncios")).some((r) => r.id === id)) throw new HttpError(404, "Aviso no encontrado");
  await store.rowDel(id);
  return NextResponse.json({ ok: true });
});
