import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { store } from "@/lib/store";

/** Marca un chat como no leído (o leído) en WhatsApp, para no olvidarlo si se abrió sin querer. */
export const POST = handle(async (req: Request) => {
  await requireSession();
  const { id, unread } = (await req.json().catch(() => ({}))) as { id?: string; unread?: boolean };
  if (!/^\d{6,20}@s\.whatsapp\.net$/.test(String(id))) throw new HttpError(400, "Chat no válido");
  await store.waSetUnread(String(id), unread !== false);
  return NextResponse.json({ ok: true });
});
