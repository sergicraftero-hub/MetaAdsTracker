import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { deviceCount, pushPublicKey, removeSubscription, saveSubscription } from "@/lib/push";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Clave pública para activar las notificaciones en un dispositivo, y cuántos tiene ya el usuario. */
export const GET = handle(async () => {
  const me = await requireSession();
  const ready = await store.portalReady();
  return NextResponse.json({ ready, key: pushPublicKey(), devices: ready ? await deviceCount(me.email) : 0 });
});

/** Guarda la suscripción push de este dispositivo. */
export const POST = handle(async (req: Request) => {
  const me = await requireSession();
  if (!(await store.portalReady())) throw new HttpError(400, "Falta la página «BUT Calls» en Notion");
  const { subscription } = (await req.json().catch(() => ({}))) as { subscription?: never };
  try {
    await saveSubscription(me.email, subscription as never);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  const me = await requireSession();
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await removeSubscription(me.email, endpoint);
  return NextResponse.json({ ok: true });
});
