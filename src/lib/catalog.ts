/**
 * Catálogo de O2 con la comisión de cada producto. SOLO SERVIDOR: este archivo no debe importarse
 * desde ningún componente, para que las comisiones no viajen al navegador de los comerciales.
 */
import type { Product } from "./types";

type Row = [id: string, name: string, price: number, commission: number];
const family = (name: string, baf: boolean, rows: Row[]): (Product & { commission: number })[] =>
  rows.map(([id, n, price, commission]) => ({ id, family: name, name: n, price, commission, baf }));

export const CATALOG: (Product & { commission: number })[] = [
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

export const PRODUCT = new Map(CATALOG.map((p) => [p.id, p]));

/** Producto con el que se dan por hechas las ventas antiguas (600 Mb + 60 GB + M+ y Netflix, 47 €). */
export const LEGACY_PRODUCT = "ftv-600-60-n";

/** Extracomisión por lotes: altas de fibra de un código en un mes natural. */
export const LOT_TIERS: [min: number, amount: number][] = [
  [4, 450],
  [11, 1100],
  [15, 1500],
  [21, 2000],
  [31, 2300],
  [41, 2600],
];
/** Extracomisión trimestral: altas de fibra que no vienen de Movistar, por código y trimestre natural. */
export const QUARTER_TIERS: [min: number, amount: number][] = [
  [15, 750],
  [30, 1800],
];
