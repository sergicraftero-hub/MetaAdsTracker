import { NextResponse } from "next/server";
import { cronToken, runPushChecks } from "@/lib/push";
import { safeEqual } from "@/lib/password";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * La llama un servicio externo cada minuto (Vercel gratuito no tiene tareas tan frecuentes).
 * Comprueba si hay que enviar alguna notificación push. Va protegida por una clave en la dirección.
 */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  if (!safeEqual(t, cronToken())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    return NextResponse.json(await runPushChecks());
  } catch (e) {
    console.error("Fallo en la comprobación de notificaciones", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
