import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { setForecast, todayMadrid } from "@/lib/sales";

/** Dirección fija cuántas fibras espera vender aún este mes (o vuelve al cálculo automático con extra: null). */
export const PUT = handle(async (req: Request) => {
  await requireSession(true);
  const { extra } = (await req.json().catch(() => ({}))) as { extra?: number | null };
  if (extra !== null && (!Number.isFinite(Number(extra)) || Number(extra) < 0 || Number(extra) > 500)) throw new HttpError(400, "Número no válido");
  await setForecast(todayMadrid().slice(0, 7), extra === null ? null : Math.round(Number(extra)));
  return NextResponse.json({ ok: true });
});
