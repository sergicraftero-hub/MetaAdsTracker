"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lead, LeadsPayload, WaChat, WaMessage } from "@/lib/types";
import { digits, str } from "./util";

interface Inbox {
  configured: boolean;
  ok: boolean;
  status: string;
  phone: string;
  chats: WaChat[];
}

const MAX = 4 * 1024 * 1024;
const hour = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
function shortDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString() ? hour(iso) : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
const dayTitle = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
const TICKS: Record<string, string> = { pending: "🕓", sent: "✓", delivered: "✓✓", read: "✓✓ leído", played: "✓✓ leído", failed: "no enviado" };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url).catch(() => null);
  const j = await res?.json().catch(() => ({}));
  if (res?.status === 401) window.location.href = "/login";
  if (!res?.ok) throw new Error(j?.error ?? "Sin conexión");
  return j as T;
}

/** Conversación de WhatsApp con un número, con caja para escribir y adjuntar. */
interface ChatProps {
  chat: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onOpenLead?: () => void;
  toast: (m: string, e?: boolean) => void;
  /** Comercial que lleva el chat ("" si nadie); sin definir, no se muestra el selector */
  owner?: string;
  comerciales?: string[];
  onAssign?: (owner: string) => void;
  /** Marca el chat como no leído y lo cierra */
  onUnread?: () => void;
}

export function ChatView({ chat, title, subtitle, onBack, onOpenLead, toast, owner, comerciales, onAssign, onUnread }: ChatProps) {
  const [messages, setMessages] = useState<WaMessage[] | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  const load = useCallback(
    async (read: boolean) => {
      try {
        const r = await getJson<{ messages: WaMessage[] }>(`/api/whatsapp/chat?id=${encodeURIComponent(chat)}${read ? "&leer=1" : ""}`);
        setMessages(r.messages);
        setError("");
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [chat],
  );

  useEffect(() => {
    setMessages(null);
    count.current = 0;
    load(true);
    const timer = setInterval(() => document.visibilityState === "visible" && load(false), 6000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (messages && messages.length !== count.current) {
      count.current = messages.length;
      end.current?.scrollIntoView({ block: "end" });
    }
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (file && file.size > MAX) return toast("El archivo supera los 4 MB", true);
    setBusy(true);
    const form = new FormData();
    form.append("id", chat);
    form.append("text", text);
    if (file) form.append("file", file);
    if (owner !== undefined) form.append("owner", owner);
    const res = await fetch("/api/whatsapp/chat", { method: "POST", body: form }).catch(() => null);
    const j = await res?.json().catch(() => ({}));
    if (res?.ok) {
      setMessages((m) => [...(m ?? []), j.message]);
      if (j.labels) onAssign?.("__refresh");
      setText("");
      setFile(null);
      setFileKey((k) => k + 1);
    } else toast(`No se envió: ${j?.error ?? "sin conexión"}`, true);
    setBusy(false);
  }

  let lastDay = "";
  return (
    <div className="chat">
      <header className="chat-head">
        {onBack && <button className="btn small" onClick={onBack}>←</button>}
        <div className="chat-title">
          <strong>{title}</strong>
          {subtitle && <span className="muted hint">{subtitle}</span>}
        </div>
        {owner !== undefined && comerciales && onAssign && (
          <select className="owner" value={owner} aria-label="Comercial que lleva el chat" onChange={(e) => onAssign(e.target.value)}>
            <option value="">Sin asignar</option>
            {comerciales.map((c) => <option key={c}>{c}</option>)}
            {owner && !comerciales.includes(owner) && <option>{owner}</option>}
          </select>
        )}
        {onUnread && <button className="btn small" onClick={onUnread} title="Dejar el chat como no leído para no olvidarlo">No leído</button>}
        {onOpenLead && <button className="btn small" onClick={onOpenLead}>Ver ficha</button>}
      </header>
      <div className="chat-body">
        {error && <p className="error hint">{error}</p>}
        {messages === null && !error && <p className="muted hint">Cargando conversación…</p>}
        {messages?.length === 0 && <p className="muted hint">Aún no hay mensajes con este número. Escribe el primero.</p>}
        {messages?.map((m) => {
          const day = dayTitle(m.at);
          const sep = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id} className="msg-wrap">
              {sep && <div className="day-sep cap">{day}</div>}
              <div className={m.fromMe ? "msg me" : "msg"}>
                {m.file &&
                  (m.file.mime.startsWith("image/") ? (
                    <a href={`/api/whatsapp/media/${m.file.id}`} target="_blank" rel="noreferrer">
                      <img src={`/api/whatsapp/media/${m.file.id}`} alt={m.file.kind} loading="lazy" />
                    </a>
                  ) : m.file.mime.startsWith("audio/") ? (
                    <audio controls preload="none" src={`/api/whatsapp/media/${m.file.id}`} />
                  ) : (
                    <a className="file" href={`/api/whatsapp/media/${m.file.id}`} download={m.file.name}>
                      📎 {m.file.name}
                    </a>
                  ))}
                {m.text && <span className="note-text">{m.text}</span>}
                <span className="msg-meta">
                  {m.fromMe && m.by ? `${m.by} · ` : ""}
                  {hour(m.at)}
                  {m.fromMe && m.status ? ` · ${TICKS[m.status] ?? m.status}` : ""}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form className="chat-form" onSubmit={send}>
        {file && (
          <span className="pill attach-pill">
            📎 {file.name}
            <button type="button" aria-label="Quitar archivo" onClick={() => { setFile(null); setFileKey((k) => k + 1); }}>×</button>
          </span>
        )}
        <div className="chat-row">
          <label className="icon-btn clip" title="Adjuntar archivo (hasta 4 MB)">
            📎
            <input key={fileKey} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <textarea
            rows={1}
            value={text}
            placeholder="Escribe un mensaje"
            aria-label="Mensaje"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !busy && (text.trim() || file)) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button className="btn primary" disabled={busy || (!text.trim() && !file)}>{busy ? "…" : "Enviar"}</button>
        </div>
      </form>
    </div>
  );
}

/** Pestaña WhatsApp: la bandeja del número compartido, igual para todo el equipo. */
export default function WhatsApp({ data, openLead, toast }: { data: LeadsPayload; openLead: (id: string) => void; toast: (m: string, e?: boolean) => void }) {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const myCode = data.me.code;
  const [scope, setScope] = useState<"mios" | "todos">(myCode ? "mios" : "todos");
  const [onlyUnread, setOnlyUnread] = useState(false);

  const load = useCallback(async () => {
    try {
      setInbox(await getJson<Inbox>("/api/whatsapp"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const byPhone = useMemo(() => {
    const m = new Map<string, Lead>();
    for (const l of data.leads) if (l.f.telefono) m.set(digits(l.f.telefono), l);
    return m;
  }, [data.leads]);
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  /** Quién lleva el chat: su etiqueta de comercial en WhatsApp o, si no tiene, el comercial del lead */
  const ownerOf = (c: WaChat) => c.labels.find((l) => data.comerciales.some((k) => same(k, l))) ?? str(byPhone.get(c.phone)?.f.comercial);

  async function assign(chatId: string, owner: string) {
    if (owner === "__refresh") return load();
    try {
      const res = await fetch("/api/whatsapp/asignar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: chatId, owner }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Error");
      setInbox((b) => (b ? { ...b, chats: b.chats.map((c) => (c.id === chatId ? { ...c, labels: j.labels } : c)) } : b));
      toast(owner ? `Chat asignado a ${owner}` : "Chat sin asignar");
    } catch (e) {
      toast(`No se pudo asignar: ${(e as Error).message}`, true);
    }
  }

  async function markUnread(chatId: string) {
    try {
      const res = await fetch("/api/whatsapp/leido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: chatId, unread: true }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Error");
      setInbox((b) => (b ? { ...b, chats: b.chats.map((c) => (c.id === chatId ? { ...c, unread: c.unread > 0 ? c.unread : -1 } : c)) } : b));
      setOpen(null);
      toast("Marcado como no leído");
    } catch (e) {
      toast(`No se pudo marcar: ${(e as Error).message}`, true);
    }
  }

  const nameOf = (c: WaChat) => str(byPhone.get(c.phone)?.f.nombre) || c.name || `+${c.phone}`;

  if (error && !inbox) return <section className="card"><p className="error">{error}</p><button className="btn" onClick={load}>Reintentar</button></section>;
  if (!inbox) return <p className="muted">Cargando WhatsApp…</p>;
  if (!inbox.configured) {
    return (
      <section className="card">
        <h2>WhatsApp compartido</h2>
        <p className="notice">
          Falta conectar el WhatsApp. En whapi.cloud crea un canal, escanea el QR con el número del equipo y copia el token del
          canal en la variable <code>WHAPI_TOKEN</code> del servidor (Vercel → Settings → Environment Variables) y vuelve a desplegar.
        </p>
      </section>
    );
  }
  if (!inbox.ok) {
    return (
      <section className="card">
        <h2>WhatsApp compartido</h2>
        <p className="notice">
          El número no está conectado ahora mismo (estado: {inbox.status || "desconocido"}). Entra en el panel de Whapi y vuelve a
          escanear el QR con el teléfono del equipo.
        </p>
        <button className="btn" onClick={load}>Comprobar de nuevo</button>
      </section>
    );
  }

  const chats = inbox.chats
    .filter((c) => scope === "todos" || same(ownerOf(c), myCode))
    .filter((c) => !onlyUnread || c.unread !== 0)
    .filter((c) => !q || `${nameOf(c)} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  const current = inbox.chats.find((c) => c.id === open);
  const typed = digits(q);
  const lead = open ? byPhone.get(open.replace(/@.*/, "")) : undefined;

  return (
    <div className={open ? "wa has-open" : "wa"}>
      <aside className="card wa-list">
        {myCode && (
          <div className="seg" role="group" aria-label="Qué chats ver">
            <button className={scope === "mios" ? "active" : ""} onClick={() => setScope("mios")}>Mis chats</button>
            <button className={scope === "todos" ? "active" : ""} onClick={() => setScope("todos")}>Global</button>
          </div>
        )}
        <label className="check small-check">
          <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />
          Solo no leídos ({inbox.chats.filter((c) => c.unread !== 0 && (scope === "todos" || same(ownerOf(c), myCode))).length})
        </label>
        <input type="search" placeholder="Buscar chat o escribir un teléfono" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar chat" />
        <p className="muted hint">Número compartido: +{inbox.phone}</p>
        <ul className="rows">
          {chats.map((c) => (
            <li key={c.id} className="row">
              <button
                className={c.id === open ? "row-main chat-item on" : "row-main chat-item"}
                onClick={() => {
                  setOpen(c.id);
                  setInbox((b) => (b ? { ...b, chats: b.chats.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x)) } : b));
                }}
              >
                <span className="row-title">
                  <strong>{nameOf(c)}</strong>
                  {byPhone.has(c.phone) && <span className="chip c-blue">Lead</span>}
                  {ownerOf(c) && <span className="chip c-green">{ownerOf(c)}</span>}
                  {c.unread !== 0 && <span className="unread" aria-label="Sin leer">{c.unread > 0 ? c.unread : "●"}</span>}
                </span>
                <span className="row-sub muted">{c.lastFromMe ? "Tú: " : ""}{c.last || "—"}</span>
              </button>
              <span className="row-meta muted">{shortDate(c.at)}</span>
            </li>
          ))}
        </ul>
        {chats.length === 0 && typed.length >= 9 && (
          <button className="btn" onClick={() => setOpen(`${typed}@s.whatsapp.net`)}>Abrir chat con +{typed}</button>
        )}
        {chats.length === 0 && typed.length < 9 && (
          <p className="muted empty-line">{scope === "mios" && !q ? "Aún no tienes chats asignados. Mira en Global y asígnate los tuyos." : "Ningún chat coincide."}</p>
        )}
      </aside>
      <section className="card wa-chat">
        {open ? (
          <ChatView
            key={open}
            chat={open}
            title={str(lead?.f.nombre) || (current ? nameOf(current) : `+${open.replace(/@.*/, "")}`)}
            subtitle={`+${open.replace(/@.*/, "")}`}
            onBack={() => setOpen(null)}
            onOpenLead={lead ? () => openLead(lead.id) : undefined}
            toast={toast}
            owner={current ? ownerOf(current) : ""}
            comerciales={data.comerciales}
            onAssign={(o) => assign(open, o)}
            onUnread={() => markUnread(open)}
          />
        ) : (
          <p className="muted empty-line">Elige un chat de la lista.</p>
        )}
      </section>
    </div>
  );
}
