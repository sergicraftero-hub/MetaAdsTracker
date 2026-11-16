import { NextResponse } from "next/server";
import { handle, requireSession } from "@/lib/auth";
import { store } from "@/lib/store";
import { digitsOf } from "@/lib/whapi";

export const dynamic = "force-dynamic";
const same = (a: string, b: string) => !!a && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Bandeja del WhatsApp compartido: estado de la sesión y lista de chats.
 * Dirección ve todos. El comercial solo recibe los suyos: los que llevan su etiqueta o son de sus leads.
 */
export const GET = handle(async () => {
  const me = await requireSession();
  if (!store.waConfigured()) return NextResponse.json({ configured: false, ok: false, status: "", phone: "", chats: [] });
  const health = await store.waHealth();
  let chats = health.ok ? await store.waChats() : [];
  if (me.role !== "admin") {
    const { leads } = await store.getLeads();
    const byPhone = new Map(leads.map((l) => [digitsOf(String(l.f.telefono ?? "")), l]));
    chats = chats.filter((c) => c.labels.some((l) => same(l, me.code)) || same(String(byPhone.get(c.phone)?.f.comercial ?? ""), me.code));
  }
  return NextResponse.json({ configured: true, ...health, chats });
});
