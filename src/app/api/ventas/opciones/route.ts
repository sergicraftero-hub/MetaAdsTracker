import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { aliasOf, allSales, catalogFor, forSeller, forecast, plan, summarize, todayMadrid } from "@/lib/sales";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Lo que necesita el formulario de contratación: catálogo (sin comisiones para el comercial), los códigos
 * por su alias, en cuál conviene cargar la venta y, si el lead ya tiene contratación, cuál es.
 */
export const GET = handle(async (req: Request) => {
  const me = await requireSession();
  const admin = me.role === "admin";
  const leadId = new URL(req.url).searchParams.get("lead") ?? "";
  const { codes, sales, cat } = await allSales();
  const summary = summarize(codes, sales, todayMadrid().slice(0, 7), cat);
  const { extra } = await forecast(summary, todayMadrid().slice(0, 7));
  const rec = { Movistar: plan(summary, cat, extra, "Movistar"), "No Movistar": plan(summary, cat, extra, "No Movistar") };
  const existing = leadId ? sales.find((s) => s.leadId === leadId && !s.baja) : undefined;
  return NextResponse.json({
    catalog: catalogFor(cat, admin),
    codes: codes.map((real) => aliasOf(real, codes)),
    // Al comercial solo se le dice qué código; el porqué lleva importes y es para dirección
    recommended: { Movistar: rec.Movistar.code, "No Movistar": rec["No Movistar"].code },
    // Ventas de fibra que le faltan a ese código para su siguiente tramo (solo el número, sin importes)
    missing: {
      Movistar: summary.find((s) => s.code === rec.Movistar.code)?.lotsNext?.need ?? null,
      "No Movistar": summary.find((s) => s.code === rec["No Movistar"].code)?.lotsNext?.need ?? null,
    },
    why: admin ? { Movistar: rec.Movistar.why, "No Movistar": rec["No Movistar"].why } : undefined,
    sale: existing ? (admin ? existing : forSeller(existing)) : null,
  });
});

/** Dirección añade un código de carga nuevo (con su nombre real). */
export const POST = handle(async (req: Request) => {
  await requireSession(true);
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  const clean = String(name ?? "").trim().slice(0, 80);
  if (clean.length < 3) throw new HttpError(400, "Escribe el nombre del código");
  await store.segAddCode(clean);
  return NextResponse.json({ ok: true });
});
