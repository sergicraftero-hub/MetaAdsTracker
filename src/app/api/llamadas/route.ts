import { NextResponse } from "next/server";
import { handle, requireSession } from "@/lib/auth";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Registro de llamadas de los últimos días. Dirección ve las de todos; un comercial, las suyas. */
export const GET = handle(async (req: Request) => {
  const me = await requireSession();
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get("dias")) || 7, 1), 31);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));
  const ready = await store.logConfigured();
  const all = ready ? await store.getLog(from.getTime()) : [];
  const calls = me.role === "admin" ? all : all.filter((c) => c.user === me.name || (!!me.code && c.code === me.code));
  return NextResponse.json({ ready, calls });
});
