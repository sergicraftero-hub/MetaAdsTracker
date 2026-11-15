/** Contrataciones («Seguimiento O2»): comisiones por venta y extracomisiones por código. Solo servidor. */
import { type Catalog, type Tier, loadCatalog } from "./catalog";
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

export function toSale(r: SegRow, codes: string[], cat: Catalog): Sale & { paid: boolean; commission: number; baf: boolean; realCode: string; fiber: boolean } {
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
  const commission = Number(r.comision ?? 0) || 0;
  // Una venta antigua sin detallar se da por fibra salvo que su comisión sea menor que la de la fibra más barata
  const cheapestFiber = Math.min(...cat.products.filter((p) => p.baf).map((p) => p.commission), Infinity);
  const hasFiber = products.length ? products.some((id) => cat.byId.get(id)?.baf) : commission >= cheapestFiber;
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
    commission: baja ? 0 : commission,
    baf: !baja && primary && hasFiber,
    fiber: hasFiber,
  };
}

/** Lo que ve un comercial de una contratación: sin dinero ni nombre real del código. */
export function forSeller(s: Sale): Sale {
  const { commission: _c, paid: _p, baf: _b, realCode: _r, ...rest } = s as Sale & { fiber?: boolean };
  delete rest.fiber;
  return rest;
}

export const commissionFor = (products: string[], cat: Catalog) => products.reduce((a, id) => a + (cat.byId.get(id)?.commission ?? 0), 0);

/** Catálogo para el navegador: con comisión solo para dirección. */
export const catalogFor = (cat: Catalog, admin: boolean): Product[] =>
  cat.products.filter((p) => admin || p.active !== false).map(({ commission, active: _a, ...p }) => (admin ? { ...p, commission } : p));

/**
 * Filas de «Seguimiento O2» que no son una venta sino un bono apuntado a mano («BONO 4 FIBRAS»…).
 * No se cuentan: la app ya calcula las extracomisiones por lotes y se sumarían dos veces.
 */
const isManualBonus = (r: SegRow) => /^\s*bono\b/i.test(str(r.nombre)) && !str(r.codigo) && !str(r.dni);

export async function allSales() {
  const [{ codigos }, rows, cat] = await Promise.all([store.segOptions(), store.segList(), loadCatalog()]);
  const real = rows.filter((r) => !isManualBonus(r));
  return { codes: codigos, cat, ignored: rows.length - real.length, sales: real.map((r) => toSale(r, codigos, cat)).sort((a, b) => b.date.localeCompare(a.date)) };
}

/* ---------- Extracomisiones ---------- */

const tier = (tiers: Tier[], n: number) => tiers.reduce((a, [min, amount]) => (n >= min ? amount : a), 0);
const nextTier = (tiers: Tier[], n: number) => tiers.find(([min]) => n < min) ?? null;

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
export function summarize(codes: string[], sales: Full[], month: string, cat: Catalog): CodeSummary[] {
  const q = quarterOf(`${month}-01`);
  const names = [...codes, ...(sales.some((s) => !s.realCode) ? [""] : [])];
  return names.map((real) => {
    const mine = sales.filter((s) => s.realCode === real);
    const ofMonth = mine.filter((s) => monthOf(s.date) === month);
    const monthBaf = ofMonth.filter((s) => s.baf).length;
    const quarterBaf = mine.filter((s) => quarterOf(s.date) === q && s.baf && s.origin !== "Movistar").length;
    const ln = nextTier(cat.lots, monthBaf);
    const qn = nextTier(cat.quarter, quarterBaf);
    // Las ventas sin código no generan extracomisión: no están cargadas en ningún punto de venta
    const counts = !!real;
    return {
      code: real ? aliasOf(real, codes) : "Sin código",
      realCode: real,
      monthBaf,
      lots: counts ? tier(cat.lots, monthBaf) : 0,
      lotsNext: counts && ln ? { need: ln[0] - monthBaf, amount: ln[1] } : null,
      quarterBaf,
      quarter: counts ? tier(cat.quarter, quarterBaf) : 0,
      quarterNext: counts && qn ? { need: qn[0] - quarterBaf, amount: qn[1] } : null,
      sales: ofMonth.filter((s) => !s.baja).length,
      commission: ofMonth.reduce((a, s) => a + s.commission, 0),
    };
  });
}

/* ---------- En qué código cargar: plan del mes ---------- */

const FORECAST_ROW = "__prevision";

/** Fibras que quedan por vender este mes: lo que ha fijado dirección o, si no, lo que sale del ritmo actual. */
export async function forecast(summary: CodeSummary[], month: string): Promise<{ extra: number; auto: number; manual: boolean }> {
  const today = todayMadrid();
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = monthOf(today) === month ? Number(today.slice(8, 10)) : days;
  const sold = summary.filter((s) => s.realCode).reduce((a, s) => a + s.monthBaf, 0);
  const auto = Math.max(0, Math.round((sold / Math.max(1, day)) * (days - day)));
  try {
    const rows = await store.rowsList("ajustes", { property: "Usuario", title: { equals: FORECAST_ROW } });
    const saved = JSON.parse(str(rows.find((r) => str(r.Usuario) === FORECAST_ROW)?.Plantillas) || "null");
    if (saved && saved.month === month && Number.isFinite(saved.extra)) return { extra: Math.max(0, Math.round(saved.extra)), auto, manual: true };
  } catch {}
  return { extra: auto, auto, manual: false };
}

/** Dirección fija (o quita, con null) cuántas fibras espera vender aún este mes. */
export async function setForecast(month: string, extra: number | null): Promise<void> {
  const rows = await store.rowsList("ajustes", { property: "Usuario", title: { equals: FORECAST_ROW } });
  const row = rows.find((r) => str(r.Usuario) === FORECAST_ROW);
  const json = JSON.stringify(extra === null ? {} : { month, extra });
  if (row) await store.rowSet("ajustes", row.id, { Plantillas: json });
  else await store.rowAdd("ajustes", { Usuario: FORECAST_ROW, Plantillas: json });
}

export interface Plan {
  /** Código en el que cargar la próxima venta */
  code: string;
  why: string;
  /** Fibras que el plan lleva a cada código y hasta dónde lo deja */
  steps: { code: string; add: number; reach: number; gain: number }[];
  /** Rápel extra que se gana con el plan */
  gain: number;
}

/**
 * Reparto de las próximas `extra` fibras entre los códigos que da más rápel EN TOTAL.
 * Los tramos son importes totales (llegar a 11 son 1.100 €, no 450 + 1.100), así que lo que vale cada
 * tramo es la diferencia con lo que el código ya tiene ganado. No basta mirar el siguiente tramo de cada
 * código: con 7 ventas por delante puede rendir más llevar un código de 4 a 11 que otro de 16 a 21.
 * Si la venta no viene de Movistar, suma también lo que se gana en el rápel trimestral.
 */
export function plan(summary: CodeSummary[], cat: Catalog, extra: number, origin: SaleOrigin): Plan {
  const codes = summary.filter((s) => s.realCode);
  if (!codes.length) return { code: "", why: "", steps: [], gain: 0 };
  const R = Math.min(Math.max(0, extra), 120);
  const value = (s: CodeSummary, x: number) =>
    tier(cat.lots, s.monthBaf + x) - s.lots + (origin !== "Movistar" ? tier(cat.quarter, s.quarterBaf + x) - s.quarter : 0);
  // Programación dinámica: best[r] = mejor ganancia usando r ventas entre los códigos vistos
  let best: { gain: number; alloc: number[] }[] = Array.from({ length: R + 1 }, () => ({ gain: 0, alloc: [] }));
  for (const s of codes) {
    const next = Array.from({ length: R + 1 }, () => ({ gain: -1, alloc: [] as number[] }));
    for (let r = 0; r <= R; r++) {
      for (let x = 0; x <= r; x++) {
        const g = best[r - x].gain + value(s, x);
        // A igual ganancia se queda con el reparto que menos ventas mete en este código
        if (g > next[r].gain) next[r] = { gain: g, alloc: [...best[r - x].alloc, x] };
      }
    }
    best = next;
  }
  // Entre los repartos de máxima ganancia, el que menos ventas necesita
  let top = best[0];
  for (let r = 1; r <= R; r++) if (best[r].gain > top.gain) top = best[r];
  const steps = codes
    .map((s, i) => ({ code: s.code, add: top.alloc[i] ?? 0, reach: s.monthBaf + (top.alloc[i] ?? 0), gain: value(s, top.alloc[i] ?? 0), need: s.lotsNext?.need ?? Infinity }))
    .filter((x) => x.add > 0);

  if (!steps.length) {
    // Con las ventas previstas no se alcanza ningún tramo: se apunta al que queda más cerca
    const near = [...codes].sort((a, b) => (a.lotsNext?.need ?? Infinity) - (b.lotsNext?.need ?? Infinity))[0];
    return {
      code: near.code,
      why: near.lotsNext
        ? `Con las ventas previstas no se llega a ningún tramo nuevo. El más cercano es el de ${near.code}: le faltan ${near.lotsNext.need} fibras para ${near.lotsNext.amount} €.`
        : "Todos los códigos están ya en su tramo más alto.",
      steps: [],
      gain: 0,
    };
  }
  // Se empieza por el tramo que antes se cierra, para asegurar esa ganancia cuanto antes
  const first = [...steps].sort((a, b) => a.need - b.need)[0];
  return {
    code: first.code,
    why: `Con unas ${R} fibras más este mes, lo que más rápel da es llevar ${steps.map((x) => `${x.code} a ${x.reach} fibras (+${x.gain} €)`).join(" y ")}.`,
    steps: steps.map(({ need: _n, ...x }) => x),
    gain: top.gain,
  };
}
