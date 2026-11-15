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

/** Las etiquetas de WhatsApp llevan a veces caracteres invisibles delante. */
export const cleanLabel = (s: unknown) => String(s ?? "").replace(/[\u200e\u200f\u202a-\u202e]/g, "").trim();
const sameLabel = (a: string, b: string) => cleanLabel(a).toLowerCase() === cleanLabel(b).toLowerCase();

const labelNames = (c: any): string[] => ((c.labels ?? []) as any[]).map((l) => cleanLabel(l.name));

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

export async function waChats(count = 150): Promise<WaChat[]> {
  const res = await json(`/chats?count=${count}`);
  return ((res.chats ?? []) as any[])
    .filter((c) => c.type === "contact" || String(c.id).endsWith("@s.whatsapp.net"))
    .map((c) => {
      const last = c.last_message ? toMessage(c.last_message) : undefined;
      return {
        id: String(c.id),
        phone: String(c.phone ?? String(c.id).replace(/@.*/, "")),
        // Whapi no siempre da el nombre del chat: se usa el del remitente del último mensaje recibido
        name: String(c.name ?? (c.last_message && !c.last_message.from_me ? (c.last_message.from_name ?? "") : "")),
        at: new Date(Number(c.timestamp ?? c.last_message?.timestamp ?? 0) * 1000).toISOString(),
        unread: Number(c.unread ?? 0) || (labelNames(c).some((n) => sameLabel(n, UNREAD_LABEL)) ? -1 : 0),
        last: last ? last.text || (last.file ? `[${last.file.kind}]` : "") : "",
        lastFromMe: !!last?.fromMe,
        labels: labelNames(c).filter((n) => n && !sameLabel(n, UNREAD_LABEL)),
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

/** Etiqueta con la que la app recuerda que un chat está pendiente de leer. */
export const UNREAD_LABEL = "No leído";
let labelCache: { at: number; list: { id: string; name: string }[] } | undefined;

async function allLabels(force = false): Promise<{ id: string; name: string }[]> {
  if (!force && labelCache && Date.now() - labelCache.at < 5 * 60_000) return labelCache.list;
  const res = await json("/labels");
  const list = ((Array.isArray(res) ? res : (res?.labels ?? [])) as any[]).map((l) => ({ id: String(l.id), name: cleanLabel(l.name) }));
  labelCache = { at: Date.now(), list };
  return list;
}

/**
 * Marca el chat como no leído (o leído). WhatsApp no devuelve esa marca manual en la lista de chats,
 * así que además se pone la etiqueta «No leído», que sí ve todo el equipo, en Mis chats y en Global.
 */
export async function waSetUnread(chatId: string, unread: boolean): Promise<void> {
  await json(`/chats/${encodeURIComponent(chatId)}`, "PATCH", { mark_unread: unread }).catch(() => {});
  let list = await allLabels();
  let label = list.find((l) => sameLabel(l.name, UNREAD_LABEL));
  if (!unread) {
    if (label) await json(`/labels/${label.id}/${encodeURIComponent(chatId)}`, "DELETE").catch(() => {});
    return;
  }
  if (!label) {
    list = await allLabels(true);
    label = list.find((l) => sameLabel(l.name, UNREAD_LABEL));
  }
  if (!label) {
    const id = String(Math.max(0, ...list.map((l) => Number(l.id) || 0)) + 1);
    await json("/labels", "POST", { id, name: UNREAD_LABEL, color: "salmon" });
    label = { id, name: UNREAD_LABEL };
    labelCache = undefined;
  }
  await json(`/labels/${label.id}/${encodeURIComponent(chatId)}`, "POST");
}

export async function waMarkRead(messageId: string): Promise<void> {
  await json(`/messages/${encodeURIComponent(messageId)}`, "PUT");
}

/** Archivo adjunto de un mensaje (se sirve a través de la app porque necesita el token). */
export const waMedia = (id: string) => call(`/media/${encodeURIComponent(id)}`, { headers: { Accept: "*/*" } });

/* ---------- Asignación de chats: una etiqueta de WhatsApp Business con el nombre del comercial ---------- */

const COLORS = ["lightskyblue", "gold", "plum", "mediumturquoise", "violet", "greenyellow", "lightpink", "cornflowerblue", "goldenrod", "cyan"];

/**
 * Asigna el chat a un comercial (o lo deja sin asignar con `owner` vacío).
 * Quita las etiquetas de otros comerciales y pone la suya, creándola si no existe.
 */
export async function waAssign(chatId: string, owner: string, comerciales: string[]): Promise<string[]> {
  const [labels, chat] = await Promise.all([json("/labels"), json(`/chats/${encodeURIComponent(chatId)}`).catch(() => ({}))]);
  const all = (Array.isArray(labels) ? labels : (labels?.labels ?? [])) as any[];
  const current = ((chat?.labels ?? []) as any[]).map((l) => ({ id: String(l.id), name: cleanLabel(l.name) }));
  const isComercial = (name: string) => comerciales.some((c) => sameLabel(c, name));
  for (const l of current) {
    if (isComercial(l.name) && !sameLabel(l.name, owner)) await json(`/labels/${l.id}/${encodeURIComponent(chatId)}`, "DELETE");
  }
  let kept = current.filter((l) => !isComercial(l.name) || sameLabel(l.name, owner));
  if (owner && !kept.some((l) => sameLabel(l.name, owner))) {
    let label = all.find((l) => sameLabel(l.name, owner));
    if (!label) {
      const id = String(Math.max(0, ...all.map((l) => Number(l.id) || 0)) + 1);
      await json("/labels", "POST", { id, name: owner, color: COLORS[all.length % COLORS.length] });
      label = { id, name: owner };
    }
    await json(`/labels/${label.id}/${encodeURIComponent(chatId)}`, "POST");
    kept = [...kept, { id: String(label.id), name: owner }];
  }
  return kept.map((l) => l.name);
}
