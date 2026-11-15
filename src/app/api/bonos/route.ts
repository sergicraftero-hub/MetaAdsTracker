import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { cleanBonus, isFor, periodStart, progress } from "@/lib/bonus";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Bonos con su progreso. Dirección ve todos; un comercial, los del equipo y los suyos que estén activos. */
export const GET = handle(async () => {
  const me = await requireSession();
  const ready = await store.bonusConfigured();
  const all = ready ? await store.listBonuses() : [];
  const mine = me.role === "admin" ? all : all.filter((b) => b.active && isFor(b, me));
  const log = mine.length && (await store.logConfigured()) ? await store.getLog(periodStart("mes").getTime()) : [];
  return NextResponse.json({ ready, bonuses: mine.map((b) => ({ ...b, value: progress(b, log) })) });
});

export const POST = handle(async (req: Request) => {
  await requireSession(true);
  if (!(await store.bonusConfigured())) throw new HttpError(400, "Falta la página «BUT Calls» en Notion para guardar los bonos");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json({ bonus: await store.saveBonus(null, cleanBonus(body, true)) });
});
