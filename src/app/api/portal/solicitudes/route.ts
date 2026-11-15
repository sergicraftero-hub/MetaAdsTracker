import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { LEAVE_TYPES, toLeave } from "@/lib/portal";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Solicitudes (vacaciones y demás). El trabajador ve las suyas; dirección, las de todos. */
export const GET = handle(async () => {
  const me = await requireSession();
  if (!(await store.portalReady())) return NextResponse.json({ ready: false, requests: [], types: LEAVE_TYPES });
  const all = (await store.rowsList("solicitudes")).map(toLeave).sort((a, b) => b.created.localeCompare(a.created));
  // Las ausencias aprobadas del equipo se ven en el calendario de todos, sin la nota
  const requests = me.role === "admin" ? all : all.filter((r) => r.user === me.email || r.status === "aprobada").map((r) => (r.user === me.email ? r : { ...r, note: "", resolved: "" }));
  return NextResponse.json({ ready: true, requests, types: LEAVE_TYPES });
});

export const POST = handle(async (req: Request) => {
  const me = await requireSession();
  const b = (await req.json().catch(() => ({}))) as { type?: string; from?: string; to?: string; note?: string };
  const type = LEAVE_TYPES.includes(String(b.type)) ? String(b.type) : "";
  const from = String(b.from ?? "");
  const to = String(b.to ?? "") || from;
  if (!type) throw new HttpError(400, "Elige el tipo de solicitud");
  if (!DAY.test(from) || !DAY.test(to) || to < from) throw new HttpError(400, "Las fechas no son válidas");
  if ((new Date(to).getTime() - new Date(from).getTime()) / 86400_000 > 366) throw new HttpError(400, "El periodo es demasiado largo");
  const note = String(b.note ?? "").trim().slice(0, 1000);
  const row = await store.rowAdd("solicitudes", { Solicitud: `${me.name} · ${type} · ${from}`, Usuario: me.email, Nombre: me.name, Tipo: type, Desde: from, Hasta: to, Estado: "pendiente", Nota: note, Resuelto: "" });
  return NextResponse.json({ request: toLeave(row) });
});

/** Dirección aprueba o rechaza. */
export const PATCH = handle(async (req: Request) => {
  const me = await requireSession(true);
  const b = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
  if (b.status !== "aprobada" && b.status !== "rechazada" && b.status !== "pendiente") throw new HttpError(400, "Estado no válido");
  const current = toLeave(await store.rowGet(String(b.id ?? "")));
  const when = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" }).format(new Date());
  const row = await store.rowSet("solicitudes", current.id, { Estado: b.status, Resuelto: b.status === "pendiente" ? "" : `${me.name} · ${when}` });
  return NextResponse.json({ request: toLeave(row) });
});

/** El trabajador retira una solicitud suya que aún está pendiente (dirección puede borrar cualquiera). */
export const DELETE = handle(async (req: Request) => {
  const me = await requireSession();
  const current = toLeave(await store.rowGet(new URL(req.url).searchParams.get("id") ?? ""));
  if (me.role !== "admin" && (current.user !== me.email || current.status !== "pendiente")) throw new HttpError(403, "Solo puedes retirar tus solicitudes pendientes");
  await store.rowDel(current.id);
  return NextResponse.json({ ok: true });
});
