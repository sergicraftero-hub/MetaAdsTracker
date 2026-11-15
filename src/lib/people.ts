import { store } from "./store";

/** Códigos de comercial: las opciones de la columna COMERCIAL más los códigos de los usuarios activos. */
export async function comercialCodes(): Promise<string[]> {
  const [schema, users] = await Promise.all([store.getSchema(), store.listUsers().catch(() => [])]);
  const set = new Set<string>((schema.comercial.options ?? []).map((o) => o.name));
  for (const u of users) if (u.code && u.active) set.add(u.code);
  return [...set];
}

/** Horas de jornada al día: entre 0 (sin límite) y 16. */
export function cleanHours(v: unknown): number {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 16) : 0;
}

