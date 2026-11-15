import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { visibleLead } from "@/lib/leadRules";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

/** El móvil o tablet del usuario pregunta si tiene alguna llamada pendiente de aceptar. */
export const GET = handle(async () => {
  const me = await requireSession();
  return NextResponse.json({ alerts: await store.listAlerts(me.email) });
});

/** Desde el ordenador: pide al móvil del mismo usuario que llame a este lead. */
export const POST = handle(async (req: Request) => {
  const me = await requireSession();
  const { leadId } = (await req.json().catch(() => ({}))) as { leadId?: string };
  const lead = await visibleLead(me, String(leadId ?? ""));
  const phone = String(lead.f.telefono ?? "");
  if (!phone) throw new HttpError(400, "Este lead no tiene teléfono");
  const ok = await store.addAlert(me.email, { leadId: lead.id, name: String(lead.f.nombre ?? ""), phone });
  if (!ok) throw new HttpError(400, "Falta la página «BUT Calls» en Notion para poder enviar avisos al móvil");
  return NextResponse.json({ ok: true });
});

/** El móvil informa de cuánto duró la llamada que aceptó (tiempo que estuvo fuera de la app). */
export const PATCH = handle(async (req: Request) => {
  const me = await requireSession();
  const { id, away } = (await req.json().catch(() => ({}))) as { id?: string; away?: number };
  const seconds = Math.min(Math.max(Math.round(Number(away) || 0), 0), 4 * 3600);
  if (id && seconds) await store.setAlertAway(me.email, String(id), seconds);
  return NextResponse.json({ ok: true });
});

/** El aviso se ha descartado en el móvil. */
export const DELETE = handle(async (req: Request) => {
  const me = await requireSession();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if ((await store.listAlerts(me.email)).some((a) => a.id === id)) await store.removeAlert(id);
  return NextResponse.json({ ok: true });
});
