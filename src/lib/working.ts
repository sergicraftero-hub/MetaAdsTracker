import { toShift } from "./portal";
import { store } from "./store";
import type { Shift } from "./types";

interface Working {
  /** false si el portal (y por tanto el fichaje) no está configurado: entonces no se aplica ninguna regla de turno */
  ready: boolean;
  emails: Set<string>;
  /** Códigos de comercial de quienes tienen la jornada abierta ahora mismo */
  codes: string[];
  /** Jornadas abiertas ahora mismo */
  shifts: Shift[];
  /** Horas de jornada al día de cada usuario, por email */
  hours: Map<string, number>;
}

const g = globalThis as unknown as { __crmWorking?: { at: number; value: Working } };

/** Quién está trabajando ahora: los que han fichado la entrada y aún no la salida. */
export async function working(): Promise<Working> {
  if (g.__crmWorking && Date.now() - g.__crmWorking.at < 20_000) return g.__crmWorking.value;
  let value: Working = { ready: false, emails: new Set(), codes: [], shifts: [], hours: new Map() };
  try {
    if (await store.portalReady()) {
      const [rows, users] = await Promise.all([store.rowsList("fichajes", { property: "Salida", date: { is_empty: true } }), store.listUsers()]);
      const emails = new Set(rows.filter((r) => !r.Salida).map((r) => String(r.Usuario ?? "").toLowerCase()));
      value = {
        ready: true,
        emails,
        codes: users.filter((u) => u.active && u.code && emails.has(u.email)).map((u) => u.code),
        shifts: rows.map(toShift).filter((x) => !x.end),
        hours: new Map(users.map((u) => [u.email, u.hours ?? 0])),
      };
    }
  } catch (e) {
    console.error("No se pudo leer quién ha fichado", e);
  }
  g.__crmWorking = { at: Date.now(), value };
  return value;
}

/** Tras fichar, la lista de quién trabaja se vuelve a leer. */
export const resetWorking = () => {
  g.__crmWorking = undefined;
};
