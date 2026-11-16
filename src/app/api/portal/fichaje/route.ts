import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { monthShifts, openShift, people, shiftValues, toShift } from "@/lib/portal";
import { store } from "@/lib/store";
import { resetWorking } from "@/lib/working";

export const dynamic = "force-dynamic";

/** Fichajes de un mes. Cada trabajador ve los suyos; dirección, los de quien elija o los de todos. */
export const GET = handle(async (req: Request) => {
  const me = await requireSession();
  const q = new URL(req.url).searchParams;
  if (!(await store.portalReady())) return NextResponse.json({ ready: false, open: null, shifts: [], people: [] });
  const month = q.get("mes") ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date()).slice(0, 7);
  const who = me.role === "admin" ? (q.get("usuario") ?? me.email) : me.email;
  const [open, all, team] = await Promise.all([openShift(me.email), monthShifts(month), me.role === "admin" ? people(me) : Promise.resolve([])]);
  return NextResponse.json({ ready: true, open, shifts: who === "todos" ? all : all.filter((s) => s.user === who), people: team, now: new Date().toISOString() });
});

/** Fichar: entrar, empezar o terminar un descanso, y salir. La hora la pone siempre el servidor. */
export const POST = handle(async (req: Request) => {
  const me = await requireSession();
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  const now = new Date().toISOString();
  const open = await openShift(me.email);
  resetWorking();

  if (action === "entrar") {
    if (open) throw new HttpError(409, "Ya tienes una jornada abierta");
    const date = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short" }).format(new Date());
    const row = await store.rowAdd("fichajes", { Registro: `${me.name} · ${date}`, Usuario: me.email, Nombre: me.name, Correcciones: "", ...shiftValues(me.email, now, null, []) });
    return NextResponse.json({ open: toShift(row) });
  }
  if (!open) throw new HttpError(409, "No tienes ninguna jornada abierta");
  const onBreak = open.breaks.some((b) => !b.e);
  let breaks = open.breaks;
  let end: string | null = null;
  if (action === "pausa") {
    if (onBreak) throw new HttpError(409, "Ya estás en un descanso");
    breaks = [...breaks, { s: now, e: null }];
  } else if (action === "reanudar") {
    if (!onBreak) throw new HttpError(409, "No estás en un descanso");
    breaks = breaks.map((b) => (b.e ? b : { ...b, e: now }));
  } else if (action === "salir") {
    breaks = breaks.map((b) => (b.e ? b : { ...b, e: now }));
    end = now;
  } else throw new HttpError(400, "Acción no válida");
  const row = await store.rowSet("fichajes", open.id, shiftValues(me.email, open.start, end, breaks));
  return NextResponse.json({ open: end ? null : toShift(row), closed: end ? toShift(row) : undefined });
});

/** Corrección de un registro por dirección: obligatorio indicar el motivo; queda anotado quién, cuándo y el valor anterior. */
export const PATCH = handle(async (req: Request) => {
  const me = await requireSession(true);
  const b = (await req.json().catch(() => ({}))) as { id?: string; start?: string; end?: string | null; reason?: string };
  const reason = String(b.reason ?? "").trim();
  if (reason.length < 5) throw new HttpError(400, "Indica el motivo de la corrección");
  const current = toShift(await store.rowGet(String(b.id ?? "")));
  const start = new Date(b.start ?? current.start);
  const end = b.end === null || b.end === "" ? null : new Date(b.end ?? current.end ?? "");
  if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) throw new HttpError(400, "Fecha u hora no válida");
  if (end && end <= start) throw new HttpError(400, "La salida debe ser posterior a la entrada");
  if (start.getTime() > Date.now() || (end && end.getTime() > Date.now())) throw new HttpError(400, "No se puede fichar en el futuro");
  // Los descansos que queden fuera del nuevo horario se descartan
  const breaks = current.breaks.filter((x) => new Date(x.s) >= start && (!end || !x.e || new Date(x.e) <= end)).map((x) => (end && !x.e ? { ...x, e: end.toISOString() } : x));
  const when = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" }).format(new Date());
  const line = `${when} · ${me.name}: ${reason} (antes: ${current.start} → ${current.end ?? "sin salida"})${current.ticket ? ` [petición: ${current.ticket}]` : ""}`;
  const row = await store.rowSet("fichajes", current.id, {
    ...shiftValues(current.user, start.toISOString(), end ? end.toISOString() : null, breaks),
    Correcciones: [current.edits, line].filter(Boolean).join("\n").slice(-1900),
    // Al corregir, la petición del trabajador queda atendida
    Incidencia: "",
  });
  return NextResponse.json({ shift: toShift(row) });
});

/**
 * Petición de corrección («ticket») sobre un registro. La abre el trabajador en un fichaje suyo, explicando qué está mal;
 * el registro no cambia hasta que dirección lo corrige. Dirección puede descartarla enviando el texto vacío.
 */
export const PUT = handle(async (req: Request) => {
  const me = await requireSession();
  const b = (await req.json().catch(() => ({}))) as { id?: string; text?: string };
  const current = toShift(await store.rowGet(String(b.id ?? "")));
  if (!current.start) throw new HttpError(404, "Registro no encontrado");
  const text = String(b.text ?? "").trim().replace(/\s+/g, " ").slice(0, 400);
  if (!text) {
    if (me.role !== "admin" && current.user !== me.email) throw new HttpError(403, "No puedes tocar este registro");
    return NextResponse.json({ shift: toShift(await store.rowSet("fichajes", current.id, { Incidencia: "" })) });
  }
  if (current.user !== me.email) throw new HttpError(403, "Solo puedes pedir la corrección de tus propios fichajes");
  if (text.length < 5) throw new HttpError(400, "Explica qué hay que corregir");
  const when = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" }).format(new Date());
  return NextResponse.json({ shift: toShift(await store.rowSet("fichajes", current.id, { Incidencia: `${when} · ${text}` })) });
});
