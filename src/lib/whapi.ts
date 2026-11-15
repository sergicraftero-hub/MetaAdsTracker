/**
 * WhatsApp compartido a través de Whapi.Cloud (pasarela sobre WhatsApp Web).
 * El número se vincula con el QR en el panel de Whapi; aquí solo se usa su API.
 */
import type { WaChat, WaMessage } from "./types";

const BASE = "https://gate.whapi.cloud";
const MEDIA_TYPES = ["image", "video", "gif", "short", "document", "audio", "voice", "sticker"] as const;
const LABEL: Record<string, string> = {
  image: "Foto",
  video: "Vídeo",
  gif: "GIF",
  short: "Vídeo",
  document: "Documento",
  audio: "Audio",
  voice: "Nota de voz",
  sticker: "Sticker",
  location: "Ubicación",
  live_location: "Ubicación en directo",
  contact: "Contacto",
  contact_list: "Contactos",
  poll: "Encuesta",
  call: "Llamada",
};

export class WhapiError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export const waConfigured = () => !!process.env.WHAPI_TOKEN;

/* eslint-disable @typescript-eslint/no-explicit-any */
async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const token = process.env.WHAPI_TOKEN;
  if (!token) throw new WhapiError("Falta WHAPI_TOKEN en la configuración del servidor", 400);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(init.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new WhapiError("No se pudo conectar con Whapi");
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    const msg = j?.error?.message ?? j?.message ?? res.statusText;
    throw new WhapiError(`WhatsApp: ${msg}`, res.status === 401 || res.status === 403 ? 400 : 502);
  }
  return res;
}

const json = (path: string, method = "GET", body?: unknown) =>
  call(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json());

export const digitsOf = (s: string) => {
  const d = String(s ?? "").replace(/\D/g, "");
  return d.length === 9 ? `34${d}` : d;
};
/** ID de chat de WhatsApp para un teléfono. */
export const chatIdOf = (phone: string) => `${digitsOf(phone)}@s.whatsapp.net`;

function toMessage(m: any): WaMessage {
  const type = String(m.type ?? "");
  const media = MEDIA_TYPES.includes(type as any) ? m[type] : type === "documentWithCaption" ? m.document : undefined;
  const text =
    m.text?.body ?? m.link_preview?.body ?? media?.caption ?? m.system?.body ?? m.interactive_response?.body ?? (media ? "" : LABEL[type] ? `[${LABEL[type]}]` : type ? `[${type}]` : "");
  return {
    id: String(m.id),
    chatId: String(m.chat_id ?? ""),
    fromMe: m.from_me === true,
    at: new Date(Number(m.timestamp ?? 0) * 1000).toISOString(),
    text: String(text ?? ""),
    status: m.status ? String(m.status) : undefined,
    file: media?.id ? { id: String(media.id), name: String(media.file_name ?? LABEL[type] ?? "Archivo"), mime: String(media.mime_type ?? ""), kind: LABEL[type] ?? "Archivo" } : undefined,
  };
}

/** Estado de la sesión de WhatsApp y número vinculado. */
export async function waHealth(): Promise<{ ok: boolean; status: string; phone: string }> {
  const h = await json("/health?wakeup=true");
  const status = String(h?.status?.text ?? "");
  return { ok: status === "AUTH", status, phone: String(h?.user?.phone ?? h?.user?.id ?? "").replace(/@.*/, "") };
}

export async function waChats(count = 80): Promise<WaChat[]> {
  const res = await json(`/chats?count=${count}`);
  return ((res.chats ?? []) as any[])
    .filter((c) => c.type === "contact" || String(c.id).endsWith("@s.whatsapp.net"))
    .map((c) => {
      const last = c.last_message ? toMessage(c.last_message) : undefined;
      return {
        id: String(c.id),
        phone: String(c.phone ?? String(c.id).replace(/@.*/, "")),
        name: String(c.name ?? ""),
        at: new Date(Number(c.timestamp ?? c.last_message?.timestamp ?? 0) * 1000).toISOString(),
        unread: Number(c.unread ?? 0),
        last: last ? last.text || (last.file ? `[${last.file.kind}]` : "") : "",
        lastFromMe: !!last?.fromMe,
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

export async function waMessages(chatId: string, count = 60): Promise<WaMessage[]> {
  const res = await json(`/messages/list/${encodeURIComponent(chatId)}?count=${count}&sort=desc`);
  return ((res.messages ?? []) as any[]).map(toMessage).reverse();
}

export async function waSend(chatId: string, text: string, file?: File): Promise<WaMessage> {
  if (!file) {
    const r = await json("/messages/text", "POST", { to: chatId, body: text });
    return toMessage(r.message ?? {});
  }
  const form = new FormData();
  form.append("to", chatId);
  form.append("media", file, file.name);
  form.append("mime_type", file.type || "application/octet-stream");
  if (text) form.append("caption", text);
  const image = file.type.startsWith("image/");
  if (!image) form.append("filename", file.name);
  const r = await call(image ? "/messages/image" : "/messages/document", { method: "POST", body: form }).then((x) => x.json());
  return toMessage(r.message ?? {});
}

export async function waMarkRead(messageId: string): Promise<void> {
  await json(`/messages/${encodeURIComponent(messageId)}`, "PUT");
}

/** Archivo adjunto de un mensaje (se sirve a través de la app porque necesita el token). */
export const waMedia = (id: string) => call(`/media/${encodeURIComponent(id)}`, { headers: { Accept: "*/*" } });
