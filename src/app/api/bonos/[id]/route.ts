import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { cleanBonus } from "@/lib/bonus";
import { store } from "@/lib/store";

async function mustExist(id: string) {
  if (!(await store.listBonuses()).some((b) => b.id === id)) throw new HttpError(404, "Bono no encontrado");
}

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession(true);
  const { id } = await ctx.params;
  await mustExist(id);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json({ bonus: await store.saveBonus(id, cleanBonus(body, false)) });
});

export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession(true);
  const { id } = await ctx.params;
  await mustExist(id);
  await store.deleteBonus(id);
  return NextResponse.json({ ok: true });
});
