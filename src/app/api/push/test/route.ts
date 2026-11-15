import { NextResponse } from "next/server";
import { handle, requireSession } from "@/lib/auth";
import { demo } from "@/lib/demo";
import { cronToken, sendPush } from "@/lib/push";
import { isDemo } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Envía una notificación de prueba a los dispositivos de quien la pide. */
export const POST = handle(async () => {
  const me = await requireSession();
  const sent = await sendPush([me.email], { title: "BUT Calls", body: "Las notificaciones funcionan en este dispositivo.", tag: "prueba" });
  return NextResponse.json({ sent });
});

/** Dirección de comprobación periódica, para que dirección la copie en el servicio que la llama cada minuto. */
export const GET = handle(async (req: Request) => {
  await requireSession(true);
  return NextResponse.json({ url: `${new URL(req.url).origin}/api/cron?t=${cronToken()}`, ...(isDemo() ? { demoSent: demo.pushed() } : {}) });
});
