import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { visibleLead } from "@/lib/leadRules";
import { aliasOf, allSales, catalogFor, commissionFor, forSeller, monthOf, realOf, summarize, toSale, todayMadrid } from "@/lib/sales";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
const MAX = 4 * 1024 * 1024;

/** Backoffice de contrataciones (solo dirección): ventas, dinero por comercial y por código, y extracomisiones. */
export const GET = handle(async (req: Request) => {
  await requireSession(true);
  const month = new URL(req.url).searchParams.get("mes") ?? todayMadrid().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpError(400, "Mes no válido");
  const [{ codes, sales, ignored, cat }, options] = await Promise.all([allSales(), store.segOptions()]);
  const PRODUCT = cat.byId;
  const summary = summarize(codes, sales, month, cat);
  const ofMonth = sales.filter((s) => monthOf(s.date) === month);
  // Por comercial: cuántas ventas cuentan para objetivos (fibra de primera residencia) y cuáles no
  const sellers = new Map<string, { name: string; sales: number; fibers: number; lines: number; second: number; commission: number }>();
  for (const s of ofMonth) {
    const k = s.comercial || "Sin comercial";
    const cur = sellers.get(k) ?? { name: k, sales: 0, fibers: 0, lines: 0, second: 0, commission: 0 };
    if (!s.baja) cur.sales++;
    if (s.baf) cur.fibers++;
    else if (!s.baja && s.fiber) cur.second++;
    else if (!s.baja) cur.lines++;
    cur.commission += s.commission;
    sellers.set(k, cur);
  }
  // De qué productos sale la comisión del mes
  const mix = new Map<string, { name: string; units: number; commission: number }>();
  for (const s of ofMonth) {
    if (s.baja) continue;
    const items: [string, string, number][] = s.products.length
      ? s.products.map((id) => [id, `${PRODUCT.get(id)?.family ?? ""}: ${PRODUCT.get(id)?.name ?? id}`, PRODUCT.get(id)?.commission ?? 0])
      : [["", "Ventas antiguas sin detallar", s.commission]];
    for (const [id, name, commission] of items) {
      const cur = mix.get(id) ?? { name, units: 0, commission: 0 };
      cur.units++;
      cur.commission += commission;
      mix.set(id, cur);
    }
  }
  const live = ofMonth.filter((s) => !s.baja);
  return NextResponse.json({
    products: [...mix.values()].sort((a, b) => b.commission - a.commission),
    counts: { sales: live.length, fibers: live.filter((s) => s.baf).length, second: live.filter((s) => !s.baf && s.fiber).length, lines: live.filter((s) => !s.fiber).length, dropped: ofMonth.length - live.length },
    month,
    sales: ofMonth,
    summary,
    sellers: [...sellers.values()].sort((a, b) => b.commission - a.commission),
    totals: {
      commission: summary.reduce((a, c) => a + c.commission, 0),
      lots: summary.reduce((a, c) => a + c.lots, 0),
      quarter: summary.reduce((a, c) => a + c.quarter, 0),
    },
    catalog: catalogFor(cat, true),
    codes: codes.map((real) => ({ alias: aliasOf(real, codes), real })),
    estados: options.estados,
    ignored,
  });
});

/** Registra una contratación tras un «Firmado». La crea el comercial; el dinero lo calcula el servidor. */
export const POST = handle(async (req: Request) => {
  const me = await requireSession();
  const form = await req.formData().catch(() => null);
  if (!form) throw new HttpError(400, "Datos no válidos");
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const leadId = get("leadId");
  const lead = leadId ? await visibleLead(me, leadId) : null;

  const { codes, sales, cat } = await allSales();
  let products: string[] = [];
  try {
    products = (JSON.parse(get("products") || "[]") as unknown[]).filter((x): x is string => typeof x === "string" && cat.byId.has(x)).slice(0, 12);
  } catch {}
  if (!products.length) throw new HttpError(400, "Añade al menos un producto");
  const real = realOf(get("code"), codes);
  if (!real) throw new HttpError(400, "Elige el código en el que se carga la venta");
  if (leadId && sales.some((s) => s.leadId === leadId && !s.baja)) throw new HttpError(409, "Este lead ya tiene una contratación registrada");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(get("date")) ? get("date") : todayMadrid();
  const file = form.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile && file.size > MAX) throw new HttpError(413, "El contrato supera los 4 MB");
  const estados = (await store.segOptions()).estados;

  const row = await store.segAdd(
    {
      nombre: get("name") || String(lead?.f.nombre ?? ""),
      dni: get("dni"),
      telefono: get("phone") || String(lead?.f.telefono ?? ""),
      fecha: date,
      estado: estados.includes("Pdt cita") ? "Pdt cita" : (estados[0] ?? null),
      codigo: real,
      comision: commissionFor(products, cat),
      productos: JSON.stringify(products),
      origen: get("origin") === "No Movistar" ? "No Movistar" : "Movistar",
      primera: get("primary") === "true",
      comercial: me.code || String(lead?.f.comercial ?? "") || me.name,
      leadId,
      baja: false,
    },
    hasFile ? file : undefined,
  );
  const sale = toSale(row, codes, cat);
  return NextResponse.json({ sale: me.role === "admin" ? sale : forSeller(sale) });
});
