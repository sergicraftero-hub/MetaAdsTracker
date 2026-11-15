import { NextResponse } from "next/server";
import { handle, requireSession } from "@/lib/auth";
import { toLeave, toPayslip } from "@/lib/portal";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
const RECENT = 30 * 86400_000;
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const month = (p: string) => new Date(`${p}-01T12:00:00`).toLocaleDateString("es-ES", { month: "long", year: "numeric" });

/**
 * Avisos de la campana. Para dirección: solicitudes pendientes de aprobar.
 * Para cada trabajador: sus solicitudes resueltas y sus nóminas nuevas del último mes.
 */
export const GET = handle(async () => {
  const me = await requireSession();
  if (!(await store.portalReady())) return NextResponse.json({ pending: [], news: [] });
  const [leaveRows, slipRows] = await Promise.all([store.rowsList("solicitudes"), store.rowsList("nominas")]);
  const since = Date.now() - RECENT;
  const news: { id: string; kind: string; text: string; at: string }[] = [];
  for (const r of leaveRows) {
    const l = toLeave(r);
    const at = r.edited ?? r.created;
    if (l.user !== me.email || l.status === "pendiente" || new Date(at).getTime() < since) continue;
    const dates = l.from === l.to ? day(l.from) : `${day(l.from)} – ${day(l.to)}`;
    news.push({ id: l.id, kind: l.status, text: `${l.type} (${dates}): ${l.status === "aprobada" ? "aprobada" : "rechazada"}`, at });
  }
  for (const r of slipRows) {
    const p = toPayslip(r);
    if (p.user !== me.email || new Date(r.created).getTime() < since) continue;
    news.push({ id: p.id, kind: "nomina", text: `Ya tienes la nómina de ${month(p.period)}`, at: r.created });
  }
  news.sort((a, b) => b.at.localeCompare(a.at));
  const pending = me.role === "admin" ? leaveRows.map(toLeave).filter((l) => l.status === "pendiente") : [];
  return NextResponse.json({ pending, news });
});
