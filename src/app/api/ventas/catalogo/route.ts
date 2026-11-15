import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { FAMILIES, type Catalog, loadCatalog, resetCatalog, saveCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";
const out = (c: Catalog) => ({ products: c.products, lots: c.lots, quarter: c.quarter, custom: c.custom, families: FAMILIES });

/** Catálogo de productos, comisiones y tramos de extracomisión. Solo dirección. */
export const GET = handle(async () => {
  await requireSession(true);
  return NextResponse.json(out(await loadCatalog()));
});

export const PUT = handle(async (req: Request) => {
  await requireSession(true);
  const body = (await req.json().catch(() => ({}))) as { products?: unknown; lots?: unknown; quarter?: unknown };
  try {
    return NextResponse.json(out(await saveCatalog(body)));
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
});

/** Vuelve a los valores de partida. */
export const DELETE = handle(async () => {
  await requireSession(true);
  return NextResponse.json(out(await resetCatalog()));
});
