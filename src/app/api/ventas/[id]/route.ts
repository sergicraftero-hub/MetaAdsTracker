import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { loadCatalog } from "@/lib/catalog";
import type { SegKey, SegRow } from "@/lib/notion";
import { commissionFor, toSale } from "@/lib/sales";
import { store } from "@/lib/store";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Dirección corrige una contratación: datos, productos, código, estado, baja, comisión y cobrado. */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession(true);
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const [{ estados, codigos }, cat] = await Promise.all([store.segOptions(), loadCatalog()]);
  const PRODUCT = cat.byId;
  const v: Partial<Record<SegKey, SegRow[SegKey]>> = {};
  const text = (k: string, to: SegKey, max = 300) => {
    if (typeof b[k] === "string") v[to] = (b[k] as string).trim().slice(0, max);
  };
  text("name", "nombre");
  text("dni", "dni", 20);
  text("phone", "telefono", 30);
  text("comercial", "comercial", 60);
  text("comments", "comentarios", 1900);
  for (const [k, to] of [["date", "fecha"], ["installFiber", "instFibra"], ["installPort", "instPorta"]] as const) {
    if (b[k] === "" || b[k] === null) v[to] = null;
    else if (typeof b[k] === "string" && DAY.test(b[k] as string)) v[to] = b[k] as string;
  }
  if (typeof b.state === "string" && estados.includes(b.state)) v.estado = b.state;
  if (b.realCode === "") v.codigo = null;
  else if (typeof b.realCode === "string" && codigos.includes(b.realCode)) v.codigo = b.realCode;
  if (b.origin === "Movistar" || b.origin === "No Movistar") v.origen = b.origin;
  for (const [k, to] of [["primary", "primera"], ["baja", "baja"], ["paid", "cobrado"]] as const) if (typeof b[k] === "boolean") v[to] = b[k] as boolean;
  if (Array.isArray(b.products)) {
    const products = b.products.filter((x): x is string => typeof x === "string" && PRODUCT.has(x)).slice(0, 12);
    v.productos = JSON.stringify(products);
    // Al cambiar los productos, la comisión se recalcula salvo que se indique otra a mano
    if (b.commission === undefined) v.comision = commissionFor(products, cat);
  }
  if (b.commission !== undefined) {
    const n = Number(b.commission);
    if (!Number.isFinite(n) || n < 0 || n > 100000) throw new HttpError(400, "Comisión no válida");
    v.comision = Math.round(n * 100) / 100;
  }
  const row = await store.segSet(id, v);
  return NextResponse.json({ sale: toSale(row, codigos, cat) });
});
