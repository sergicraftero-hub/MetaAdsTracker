/** Contrataciones («Seguimiento O2»): comisiones por venta y extracomisiones por código. Solo servidor. */
import { CATALOG, LOT_TIERS, PRODUCT, QUARTER_TIERS } from "./catalog";
import type { SegRow } from "./notion";
import { store } from "./store";
import type { Product, Sale, SaleOrigin } from "./types";

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
export const todayMadrid = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

/* ---------- Códigos: el comercial ve «Código N»; el nombre real es solo para dirección ---------- */

export const aliasOf = (real: string, codes: string[]) => {
  const i = codes.indexOf(real);
  return i >= 0 ? `Código ${i + 1}` : "";
};
export const realOf = (alias: string, codes: string[]) => codes[Number(alias.replace(/\D/g, "")) - 1] ?? "";

/* ---------- Fila de Notion → contratación ---------- */

export function toSale(r: SegRow, codes: string[]): Sale & { paid: boolean; commission: number; baf: boolean; realCode: string } {
  let products: string[] = [];
  try {
    const list = JSON.parse(str(r.productos) || "[]");
    if (Array.isArray(list)) products = list.filter((x) => typeof x === "string");
  } catch {}
  const state = str(r.estado);
  const baja = r.baja === true;
  // Las contrataciones antiguas no dicen el origen: «Es movistar» lo indica, y si no, se dan por Movistar
  const origin: SaleOrigin = str(r.origen) === "No Movistar" ? "No Movistar" : "Movistar";
  // Las antiguas tampoco dicen si es primera residencia ni qué productos: se cuentan como fibra de primera residencia
  const legacy = !products.length && r.primera !== true && !str(r.origen);
  const primary = r.primera === true || legacy;
  const hasFiber = products.length ? products.some((id) => PRODUCT.get(id)?.baf) : true;
  const realCode = str(r.codigo);
  return {
    id: r.id,
    name: str(r.nombre),
    dni: str(r.dni),
    phone: str(r.telefono),
    date: (str(r.fecha) || r.created).slice(0, 10),
    installFiber: str(r.instFibra).slice(0, 10),
    installPort: str(r.instPorta).slice(0, 10),
    state,
    code: aliasOf(realCode, codes),
    realCode,
    products,
    origin,
    primary,
    comercial: str(r.comercial),
    leadId: str(r.leadId),
    baja,
    comments: str(r.comentarios),
    contract: str(r.contrato),
    paid: r.cobrado === true,
    // Una baja no cobra ni cuenta
    commission: baja ? 0 : Number(r.comision ?? 0) || 0,
    baf: !baja && primary && hasFiber,
  };
}

/** Lo que ve un comercial de una contratación: sin dinero ni nombre real del código. */
export function forSeller(s: Sale): Sale {
  const { commission: _c, paid: _p, baf: _b, realCode: _r, ...rest } = s;
  return rest;
}

export const commissionFor = (products: string[]) => products.reduce((a, id) => a + (PRODUCT.get(id)?.commission ?? 0), 0);

/** Catálogo para el navegador: con comisión solo para dirección. */
export const catalogFor = (admin: boolean): Product[] => CATALOG.map(({ commission, ...p }) => (admin ? { ...p, commission } : p));

/**
 * Filas de «Seguimiento O2» que no son una venta sino un bono apuntado a mano («BONO 4 FIBRAS»…).
 * No se cuentan: la app ya calcula las extracomisiones por lotes y se sumarían dos veces.
 */
const isManualBonus = (r: SegRow) => /^\s*bono\b/i.test(str(r.nombre)) && !str(r.codigo) && !str(r.dni);

export async function allSales() {
  const [{ codigos }, rows] = await Promise.all([store.segOptions(), store.segList()]);
  const real = rows.filter((r) => !isManualBonus(r));
  return { codes: codigos, ignored: rows.length - real.length, sales: real.map((r) => toSale(r, codigos)).sort((a, b) => b.date.localeCompare(a.date)) };
}

/* ---------- Extracomisiones ---------- */

const tier = (tiers: [number, number][], n: number) => tiers.reduce((a, [min, amount]) => (n >= min ? amount : a), 0);
const nextTier = (tiers: [number, number][], n: number) => tiers.find(([min]) => n < min) ?? null;

export const monthOf = (date: string) => date.slice(0, 7);
export function quarterOf(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return `${y}-T${Math.ceil(m / 3)}`;
}

export interface CodeSummary {
  code: string;
  realCode: string;
  /** Altas de fibra del mes y su extracomisión por lotes */
  monthBaf: number;
  lots: number;
  lotsNext: { need: number; amount: number } | null;
  /** Altas de fibra no Movistar del trimestre y su extracomisión */
  quarterBaf: number;
  quarter: number;
  quarterNext: { need: number; amount: number } | null;
  sales: number;
  commission: number;
}

type Full = ReturnType<typeof toSale>;

/** Resumen por código para un mes (lotes) y el trimestre al que pertenece (trimestral). */
export function summarize(codes: string[], sales: Full[], month: string): CodeSummary[] {
  const q = quarterOf(`${month}-01`);
  const names = [...codes, ...(sales.some((s) => !s.realCode) ? [""] : [])];
  return names.map((real) => {
    const mine = sales.filter((s) => s.realCode === real);
    const ofMonth = mine.filter((s) => monthOf(s.date) === month);
    const monthBaf = ofMonth.filter((s) => s.baf).length;
    const quarterBaf = mine.filter((s) => quarterOf(s.date) === q && s.baf && s.origin !== "Movistar").length;
    const ln = nextTier(LOT_TIERS, monthBaf);
    const qn = nextTier(QUARTER_TIERS, quarterBaf);
    // Las ventas sin código no generan extracomisión: no están cargadas en ningún punto de venta
    const counts = !!real;
    return {
      code: real ? aliasOf(real, codes) : "Sin código",
      realCode: real,
      monthBaf,
      lots: counts ? tier(LOT_TIERS, monthBaf) : 0,
      lotsNext: counts && ln ? { need: ln[0] - monthBaf, amount: ln[1] } : null,
      quarterBaf,
      quarter: counts ? tier(QUARTER_TIERS, quarterBaf) : 0,
      quarterNext: counts && qn ? { need: qn[0] - quarterBaf, amount: qn[1] } : null,
      sales: ofMonth.filter((s) => !s.baja).length,
      commission: ofMonth.reduce((a, s) => a + s.commission, 0),
    };
  });
}

/**
 * En qué código conviene cargar una venta nueva para ganar más.
 * Cada código puntúa por los euros que da su siguiente tramo repartidos entre las fibras que le faltan
 * (lotes del mes y, si la venta no viene de Movistar, también el trimestral). Así se llenan primero los
 * tramos que más rinden por venta: por ejemplo, 4 + 4 + 4 antes que 12 en un solo código.
 */
export function recommend(summary: CodeSummary[], origin: SaleOrigin): { code: string; why: string } {
  const list = summary.filter((s) => s.realCode);
  if (!list.length) return { code: "", why: "" };
  let best = { code: list[0].code, score: -1, why: "" };
  for (const s of list) {
    const lots = s.lotsNext ? (s.lotsNext.amount - s.lots) / s.lotsNext.need : 0;
    const quarter = origin !== "Movistar" && s.quarterNext ? (s.quarterNext.amount - s.quarter) / s.quarterNext.need : 0;
    if (lots + quarter > best.score) {
      const why = s.lotsNext
        ? `Le ${s.lotsNext.need === 1 ? "falta 1 fibra" : `faltan ${s.lotsNext.need} fibras`} para el tramo de ${s.lotsNext.amount} € de este mes.`
        : "Ya está en el tramo más alto de lotes este mes.";
      best = { code: s.code, score: lots + quarter, why };
    }
  }
  return { code: best.code, why: best.why };
}
