/**
 * Catálogo de O2 con la comisión de cada producto y los tramos de las extracomisiones. Dirección puede
 * cambiarlo desde Contrataciones; estos son los valores de partida. SOLO SERVIDOR: este archivo no debe importarse
 * desde ningún componente, para que las comisiones no viajen al navegador de los comerciales.
 */
import { store } from "./store";
import type { Product } from "./types";

export type Tier = [min: number, amount: number];

type Row = [id: string, name: string, price: number, commission: number];
export type CatalogProduct = Product & { commission: number; active?: boolean };
const family = (name: string, baf: boolean, rows: Row[]): CatalogProduct[] =>
  rows.map(([id, n, price, commission]) => ({ id, family: name, name: n, price, commission, baf }));

export const DEFAULT_PRODUCTS: CatalogProduct[] = [
  ...family("Fibra + fijo + móvil + TV", true, [
    ["ftv-600-35", "600 Mb + 35 GB + M+", 38, 92],
    ["ftv-1g-350", "1 Gb + 350 GB + M+", 50, 115],
    ["ftv-600-60-d", "600 Mb + 60 GB + M+ y Disney+", 45, 105],
    ["ftv-1g-375-d", "1 Gb + 375 GB + M+ y Disney+", 56, 120],
    ["ftv-600-60-n", "600 Mb + 60 GB + M+ y Netflix", 47, 105],
    ["ftv-1g-375-n", "1 Gb + 375 GB + M+ y Netflix", 58, 120],
    ["ftv-600-60-dn", "600 Mb + 60 GB + M+, Disney+ y Netflix", 52, 117],
    ["ftv-1g-375-dn", "1 Gb + 375 GB + M+, Disney+ y Netflix", 62, 125],
  ]),
  ...family("Fibra + fijo + móvil", true, [
    ["ffm-1g-120", "1 Gb + 120 GB", 38, 92],
    ["ffm-600-2l", "600 Mb + 2 líneas (10 GB + 40 GB)", 35, 83],
    ["ffm-600-60", "600 Mb + 60 GB", 35, 80],
  ]),
  ...family("Fibra + fijo", true, [
    ["ff-1g", "1 Gb", 31, 65],
    ["ff-600", "600 Mb", 27, 50],
    ["ff-300", "300 Mb", 23, 40],
  ]),
  ...family("Móvil", false, [
    ["mov-15", "15 GB", 5, 8],
    ["mov-50", "50 GB", 7, 10],
    ["mov-100", "100 GB", 10, 20],
    ["mov-150", "150 GB", 15, 36],
    ["mov-300", "300 GB", 20, 45],
  ]),
  ...family("Móvil adicional", false, [
    ["movad-40", "40 GB", 5, 13],
    ["movad-150", "150 GB", 10, 14],
    ["movad-300", "300 GB", 15, 15],
  ]),
  ...family("Fibra adicional", false, [
    ["fibad-1g", "1 Gb", 27, 21],
    ["fibad-600", "600 Mb", 20, 15],
    ["fibad-300", "300 Mb", 15, 11],
  ]),
  ...family("Extras", false, [["mplus", "Añadir M+ a fibra", 6, 5]]),
];

/** Extracomisión por lotes: altas de fibra de un código en un mes natural. */
export const DEFAULT_LOTS: Tier[] = [
  [4, 450],
  [11, 1100],
  [15, 1500],
  [21, 2000],
  [31, 2300],
  [41, 2600],
];
/** Extracomisión trimestral: altas de fibra que no vienen de Movistar, por código y trimestre natural. */
export const DEFAULT_QUARTER: Tier[] = [
  [15, 750],
  [30, 1800],
];

/** Familias de producto. Son fijas porque el lector de contratos las usa para reconocer lo contratado. */
export const FAMILIES = [...new Set(DEFAULT_PRODUCTS.map((p) => p.family))];

export interface Catalog {
  products: CatalogProduct[];
  byId: Map<string, CatalogProduct>;
  lots: Tier[];
  quarter: Tier[];
  /** true si dirección ha cambiado los valores de partida */
  custom: boolean;
}

const ROW = "__catalogo";
const g = globalThis as unknown as { __crmCatalog?: { at: number; value: Catalog } };

const build = (products: CatalogProduct[], lots: Tier[], quarter: Tier[], custom: boolean): Catalog => ({
  products,
  byId: new Map(products.map((p) => [p.id, p])),
  lots: [...lots].sort((a, b) => a[0] - b[0]),
  quarter: [...quarter].sort((a, b) => a[0] - b[0]),
  custom,
});

async function row() {
  const rows = await store.rowsList("ajustes", { property: "Usuario", title: { equals: ROW } });
  return rows.find((r) => String(r.Usuario) === ROW);
}

/** Catálogo vigente: el que haya guardado dirección o, si no, el de partida. */
export async function loadCatalog(): Promise<Catalog> {
  if (g.__crmCatalog && Date.now() - g.__crmCatalog.at < 60_000) return g.__crmCatalog.value;
  let value = build(DEFAULT_PRODUCTS, DEFAULT_LOTS, DEFAULT_QUARTER, false);
  try {
    const saved = JSON.parse(String((await row())?.Plantillas ?? "null"));
    if (saved && Array.isArray(saved.products) && saved.products.length) {
      value = build(saved.products, Array.isArray(saved.lots) ? saved.lots : DEFAULT_LOTS, Array.isArray(saved.quarter) ? saved.quarter : DEFAULT_QUARTER, true);
    }
  } catch {
    // sin portal o sin catálogo guardado: valores de partida
  }
  g.__crmCatalog = { at: Date.now(), value };
  return value;
}

const cleanTiers = (input: unknown): Tier[] =>
  (Array.isArray(input) ? input : [])
    .map((t) => [Math.round(Number(t?.[0])), Math.round(Number(t?.[1]))] as Tier)
    .filter(([min, amount]) => Number.isFinite(min) && min > 0 && Number.isFinite(amount) && amount >= 0)
    .slice(0, 12);

/** Guarda el catálogo que envía dirección, validándolo. */
export async function saveCatalog(input: { products?: unknown; lots?: unknown; quarter?: unknown }): Promise<Catalog> {
  const seen = new Set<string>();
  const products: CatalogProduct[] = [];
  for (const raw of Array.isArray(input.products) ? input.products : []) {
    const p = raw as Partial<CatalogProduct>;
    const name = String(p.name ?? "").trim().slice(0, 80);
    const fam = FAMILIES.includes(String(p.family)) ? String(p.family) : "";
    if (!name || !fam) continue;
    let id = String(p.id ?? "").trim().slice(0, 40) || `p-${products.length}-${Date.now().toString(36)}`;
    while (seen.has(id)) id += "x";
    seen.add(id);
    products.push({ id, family: fam, name, price: Math.max(0, Math.round(Number(p.price) || 0)), commission: Math.max(0, Math.round((Number(p.commission) || 0) * 100) / 100), baf: p.baf === true, active: p.active !== false });
  }
  if (!products.length) throw new Error("El catálogo no puede quedar vacío");
  const lots = cleanTiers(input.lots);
  const quarter = cleanTiers(input.quarter);
  const json = JSON.stringify({ products, lots, quarter });
  const cur = await row();
  if (cur) await store.rowSet("ajustes", cur.id, { Plantillas: json });
  else await store.rowAdd("ajustes", { Usuario: ROW, Plantillas: json });
  g.__crmCatalog = undefined;
  return loadCatalog();
}

/** Vuelve a los valores de partida (la tabla de O2 con la que se montó la app). */
export async function resetCatalog(): Promise<Catalog> {
  const cur = await row();
  if (cur) await store.rowDel(cur.id);
  g.__crmCatalog = undefined;
  return loadCatalog();
}
