import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { people, toPayslip } from "@/lib/portal";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
const MAX = 4 * 1024 * 1024;

/** Nóminas: cada trabajador ve las suyas; dirección, todas. */
export const GET = handle(async () => {
  const me = await requireSession();
  if (!(await store.portalReady())) return NextResponse.json({ ready: false, payslips: [], people: [] });
  const all = (await store.rowsList("nominas")).map(toPayslip).sort((a, b) => b.period.localeCompare(a.period) || a.name.localeCompare(b.name));
  return NextResponse.json({
    ready: true,
    payslips: me.role === "admin" ? all : all.filter((p) => p.user === me.email),
    people: me.role === "admin" ? await people(me) : [],
  });
});

/** Dirección sube la nómina en PDF de un trabajador y un mes. */
export const POST = handle(async (req: Request) => {
  const me = await requireSession(true);
  const form = await req.formData().catch(() => null);
  const user = String(form?.get("user") ?? "").trim().toLowerCase();
  const period = String(form?.get("period") ?? "");
  const file = form?.get("file");
  const person = (await people(me)).find((p) => p.email === user);
  if (!person) throw new HttpError(400, "Elige el trabajador");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new HttpError(400, "Elige el mes de la nómina");
  if (!(file instanceof File) || !file.size) throw new HttpError(400, "Adjunta el PDF de la nómina");
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new HttpError(400, "La nómina debe ser un PDF");
  if (file.size > MAX) throw new HttpError(413, "El archivo supera los 4 MB");
  const row = await store.rowAdd("nominas", { Nomina: `${person.name} · ${period}`, Usuario: person.email, Nombre: person.name, Periodo: period }, { prop: "Archivo", file });
  return NextResponse.json({ payslip: toPayslip(row) });
});

export const DELETE = handle(async (req: Request) => {
  await requireSession(true);
  const row = await store.rowGet(new URL(req.url).searchParams.get("id") ?? "");
  await store.rowDel(row.id);
  return NextResponse.json({ ok: true });
});
