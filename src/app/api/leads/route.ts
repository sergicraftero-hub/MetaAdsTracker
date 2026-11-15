import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { canSee } from "@/lib/fields";
import { cleanFields, forUser } from "@/lib/leadRules";
import { isDemo, store, unassignedVisible } from "@/lib/store";
import type { LeadsPayload } from "@/lib/types";
import { working } from "@/lib/working";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const me = await requireSession();
  const [schema, { leads, syncedAt }, users, logReady, w] = await Promise.all([
    store.getSchema(),
    store.getLeads(),
    store.listUsers().catch(() => []),
    store.logConfigured().catch(() => false),
    working(),
  ]);
  const codes = w.ready ? w.codes : null;
  const mine = w.shifts.find((x) => x.user === me.email);
  const comerciales = new Set<string>((schema.comercial.options ?? []).map((o) => o.name));
  for (const u of users) if (u.code && u.active) comerciales.add(u.code);
  const payload: LeadsPayload = {
    // El enlace a Notion solo se envía a dirección: los comerciales no deben entrar en la base
    leads: leads.filter((l) => canSee(me, l, unassignedVisible(), codes)).map((l) => forUser(me, l)),
    working: codes,
    clockedIn: w.ready ? w.emails.has(me.email) : null,
    clock: mine ? { start: mine.start, breaks: mine.breaks, hours: w.hours.get(me.email) ?? 0 } : null,
    schema,
    me,
    comerciales: [...comerciales],
    demo: isDemo(),
    syncedAt: new Date(syncedAt).toISOString(),
    logReady,
    waReady: store.waConfigured(),
  };
  return NextResponse.json(payload);
});

export const POST = handle(async (req: Request) => {
  const me = await requireSession();
  const body = (await req.json().catch(() => ({}))) as { fields?: Record<string, unknown> };
  const fields = cleanFields(body.fields ?? {}, me, undefined);
  if (!fields.nombre || !fields.telefono) throw new HttpError(400, "Nombre y teléfono son obligatorios");
  fields.fecha = new Date().toISOString();
  if (me.role === "comercial" && me.code) fields.comercial = me.code;
  return NextResponse.json({ lead: forUser(me, await store.createLead(fields)) });
});
