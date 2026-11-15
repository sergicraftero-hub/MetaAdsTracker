import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { comercialCodes } from "@/lib/people";
import { store } from "@/lib/store";

/** Asigna un chat a un comercial poniéndole su etiqueta de WhatsApp (o lo deja libre con owner vacío). */
export const POST = handle(async (req: Request) => {
  await requireSession();
  const { id, owner } = (await req.json().catch(() => ({}))) as { id?: string; owner?: string };
  if (!/^\d{6,20}@s\.whatsapp\.net$/.test(String(id))) throw new HttpError(400, "Chat no válido");
  const codes = await comercialCodes();
  const who = String(owner ?? "").trim();
  if (who && !codes.includes(who)) throw new HttpError(400, "Ese comercial no existe");
  return NextResponse.json({ labels: await store.waAssign(String(id), who, codes) });
});
