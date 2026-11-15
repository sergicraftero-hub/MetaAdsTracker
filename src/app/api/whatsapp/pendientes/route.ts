import { NextResponse } from "next/server";
import { handle, requireSession } from "@/lib/auth";
import { store } from "@/lib/store";
import { digitsOf } from "@/lib/whapi";

export const dynamic = "force-dynamic";
const same = (a: string, b: string) => !!a && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Chats del comercial con mensajes sin leer, para avisarle cuando un cliente suyo escribe. */
export const GET = handle(async () => {
  const me = await requireSession();
  if (!store.waConfigured() || !me.code) return NextResponse.json({ chats: [] });
  const [chats, { leads }] = await Promise.all([store.waChats(), store.getLeads()]);
  const byPhone = new Map(leads.map((l) => [digitsOf(String(l.f.telefono ?? "")), l]));
  const mine = chats
    .filter((c) => c.unread > 0 && !c.lastFromMe)
    .filter((c) => c.labels.some((l) => same(l, me.code)) || same(String(byPhone.get(c.phone)?.f.comercial ?? ""), me.code))
    .map((c) => ({ id: c.id, name: String(byPhone.get(c.phone)?.f.nombre ?? "") || c.name || `+${c.phone}`, unread: c.unread, last: c.last, at: c.at }));
  return NextResponse.json({ chats: mine });
});
