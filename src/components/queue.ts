import { isClosed, stageOf } from "@/lib/fields";
import type { Lead } from "@/lib/types";
import { entryTime, isDue, parseWhen, str } from "./util";

export type Source = "rellamada" | "antiguo" | "nuevo" | "ilocalizable";

export const SOURCE_LABEL: Record<Source, string> = {
  rellamada: "Rellamada",
  antiguo: "Lead antiguo sin llamar",
  nuevo: "Lead nuevo",
  ilocalizable: "Ilocalizable: reintento",
};

export interface Pick {
  lead: Lead;
  source: Source;
  /** Huecos del patrón que consume (0: una rellamada con hora, que se cuela sin gastar hueco) */
  slots: number;
}

export interface Pools {
  /** Rellamadas con hora de hoy cuya hora ya ha llegado */
  timed: Lead[];
  /** Rellamadas atrasadas de otros días, o de hoy sin hora */
  backlog: Lead[];
  /** Leads sin contactar, del más antiguo al más nuevo */
  fresh: Lead[];
  iloc: Lead[];
}

const RETRY_AFTER = 3 * 3600_000;
const attempts = (l: Lead) => [l.f.intento1, l.f.intento2, l.f.intento3].filter(Boolean).length;
const cbTime = (l: Lead) => parseWhen(l.f.rellamada)?.date.getTime() ?? 0;

export function buildPools(leads: Lead[], handled: Set<string>, now = Date.now()): Pools {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const pools: Pools = { timed: [], backlog: [], fresh: [], iloc: [] };
  for (const l of leads) {
    if (handled.has(l.id) || isClosed(l.f.estado) || !l.f.telefono) continue;
    const cb = parseWhen(l.f.rellamada);
    if (cb) {
      const t = cb.date.getTime();
      if (cb.hasTime && t <= now && t >= startOfDay.getTime()) pools.timed.push(l);
      else if (isDue(l.f.rellamada) && !(cb.hasTime && t > now)) pools.backlog.push(l);
      continue; // con rellamada futura no se toca hasta que llegue
    }
    if (stageOf(l.f.estado) === "nuevo") pools.fresh.push(l);
    else if (str(l.f.estado).toUpperCase() === "ILOCALIZABLE" && now - new Date(l.edited).getTime() > RETRY_AFTER) pools.iloc.push(l);
  }
  pools.timed.sort((a, b) => cbTime(a) - cbTime(b));
  pools.backlog.sort((a, b) => cbTime(a) - cbTime(b));
  pools.fresh.sort((a, b) => entryTime(a) - entryTime(b));
  pools.iloc.sort((a, b) => attempts(a) - attempts(b) || entryTime(a) - entryTime(b));
  return pools;
}

/**
 * Siguiente lead a llamar.
 * - Una rellamada con hora, cuando llega su hora, pasa delante de todo.
 * - El resto sigue el patrón: 2 antiguos sin llamar, 1 nuevo, 1 rellamada atrasada.
 * - Cuando se acaban los leads sin llamar, sus huecos los ocupan los ilocalizables.
 */
export function nextPick(p: Pools, slot: number): Pick | null {
  if (p.timed.length) return { lead: p.timed[0], source: "rellamada", slots: 0 };
  const oldest = (): Pick | null => (p.fresh.length ? { lead: p.fresh[0], source: "antiguo", slots: 1 } : null);
  const newest = (): Pick | null => (p.fresh.length ? { lead: p.fresh[p.fresh.length - 1], source: "nuevo", slots: 1 } : null);
  const iloc = (): Pick | null => (p.iloc.length ? { lead: p.iloc[0], source: "ilocalizable", slots: 1 } : null);
  const backlog = (): Pick | null => (p.backlog.length ? { lead: p.backlog[0], source: "rellamada", slots: 1 } : null);
  const order = [
    [oldest, iloc, backlog],
    [oldest, iloc, backlog],
    [newest, iloc, backlog],
    [backlog, oldest, iloc],
  ];
  // Sin rellamadas atrasadas, su hueco se salta y el patrón queda en 2 antiguos y 1 nuevo
  const skip = slot % 4 === 3 && !p.backlog.length ? 1 : 0;
  for (const pick of order[(slot + skip) % 4]) {
    const r = pick();
    if (r) return { ...r, slots: r.slots + skip };
  }
  return null;
}
