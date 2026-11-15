import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { comercialCodes } from "@/lib/people";
import { store } from "@/lib/store";
import { chatIdOf, digitsOf } from "@/lib/whapi";

export const dynamic = "force-dynamic";
const MAX = 4 * 1024 * 1024;

/** Acepta un ID de chat de WhatsApp o un teléfono y devuelve el ID de chat. */
function chatId(raw: string | null): string {
  const v = String(raw ?? "").trim();
  if (/^\d{6,20}@s\.whatsapp\.net$/.test(v)) return v;
  const d = digitsOf(v);
  if (d.length < 8 || d.length > 15) throw new HttpError(400, "Teléfono no válido");
  return chatIdOf(d);
}

export const GET = handle(async (req: Request) => {
  await requireSession();
  const id = chatId(new URL(req.url).searchParams.get("id"));
  const messages = await store.waMessages(id);
  // Al abrir el chat se marca como leído el último mensaje recibido
  const lastIn = [...messages].reverse().find((m) => !m.fromMe);
  if (new URL(req.url).searchParams.get("leer") === "1") {
    if (lastIn) await store.waMarkRead(lastIn.id).catch(() => {});
    // Solo si el chat estaba marcado a mano como no leído, se le quita la marca
    if (new URL(req.url).searchParams.get("marcado") === "1") await store.waSetUnread(id, false).catch(() => {});
  }
  return NextResponse.json({ id, messages });
});

export const POST = handle(async (req: Request) => {
  const me = await requireSession();
  const form = await req.formData().catch(() => null);
  const id = chatId(String(form?.get("id") ?? ""));
  const text = String(form?.get("text") ?? "").trim().slice(0, 4000);
  const file = form?.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (!text && !hasFile) throw new HttpError(400, "Escribe un mensaje o adjunta un archivo");
  if (hasFile && file.size > MAX) throw new HttpError(413, "El archivo supera los 4 MB");
  const message = await store.waSend(id, text, hasFile ? file : undefined, me.code || me.name);

  // Si el teléfono es de un lead, se marca la casilla WHATSAPP de Notion
  try {
    const phone = id.replace(/@.*/, "");
    const lead = (await store.getLeads()).leads.find((l) => digitsOf(String(l.f.telefono ?? "")) === phone);
    if (lead && lead.f.whatsapp !== true) await store.updateLead(lead.id, { whatsapp: true });
  } catch (e) {
    console.error("No se pudo marcar WHATSAPP en el lead", e);
  }
  // Si el chat aún no es de ningún comercial, pasa a ser de quien escribe
  let labels: string[] | undefined;
  if (me.code && form?.get("owner") === "") {
    try {
      labels = await store.waAssign(id, me.code, await comercialCodes());
    } catch (e) {
      console.error("No se pudo etiquetar el chat", e);
    }
  }
  return NextResponse.json({ message, labels });
});
