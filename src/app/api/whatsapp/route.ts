import { NextResponse } from "next/server";
import { handle, requireSession } from "@/lib/auth";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Bandeja del WhatsApp compartido: estado de la sesión y lista de chats. La ve todo el equipo. */
export const GET = handle(async () => {
  await requireSession();
  if (!store.waConfigured()) return NextResponse.json({ configured: false, ok: false, status: "", phone: "", chats: [] });
  const health = await store.waHealth();
  const chats = health.ok ? await store.waChats() : [];
  return NextResponse.json({ configured: true, ...health, chats });
});
