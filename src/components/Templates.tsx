"use client";
import { useEffect, useState } from "react";
import type { Template } from "@/lib/types";
import { api } from "./util";

type Toast = (m: string, e?: boolean) => void;

// Los mensajes se cargan una vez y los comparten todos los chats abiertos
let cache: Template[] | null = null;
const listeners = new Set<(t: Template[]) => void>();
const publish = (t: Template[]) => {
  cache = t;
  listeners.forEach((fn) => fn(t));
};

/** Sustituye {nombre} y {yo}. Sin nombre del cliente, el saludo queda natural («Hola, soy…»). */
export function fillTemplate(text: string, nombre: string, yo: string): string {
  const first = (s: string) => s.trim().split(/\s+/)[0] ?? "";
  const cliente = /^[+\d\s]*$/.test(nombre) ? "" : first(nombre);
  const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : "");
  return text
    .replace(/\s*\{nombre\}/gi, cliente ? ` ${cap(cliente)}` : "")
    .replace(/\{yo\}/gi, cap(first(yo)))
    .replace(/^\s+/, "");
}

/** Fila de mensajes preparados encima de la caja de escribir. Al pulsar uno, se pega en la caja (no se envía). */
export default function Templates({ nombre, yo, onPick, toast }: { nombre: string; yo: string; onPick: (text: string) => void; toast: Toast }) {
  const [list, setList] = useState<Template[]>(cache ?? []);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Template[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listeners.add(setList);
    if (!cache) {
      api<{ templates: Template[] }>("/api/plantillas")
        .then((r) => publish(r.templates))
        .catch(() => {});
    }
    return () => {
      listeners.delete(setList);
    };
  }, []);

  async function save() {
    setBusy(true);
    try {
      const r = await api<{ templates: Template[] }>("/api/plantillas", "PUT", { templates: draft });
      publish(r.templates);
      setEditing(false);
      toast("Mensajes guardados");
    } catch (e) {
      toast((e as Error).message, true);
    }
    setBusy(false);
  }

  return (
    <>
      <div className="tpl-row">
        {list.map((t, i) => (
          <button key={i} type="button" className="tag" onClick={() => onPick(fillTemplate(t.text, nombre, yo))} title={fillTemplate(t.text, nombre, yo)}>
            {t.title}
          </button>
        ))}
        <button type="button" className="tag ghost" onClick={() => { setDraft(list.map((t) => ({ ...t }))); setEditing(true); }}>
          ✎ Mis mensajes
        </button>
      </div>
      {editing && (
        <div className="overlay centered top-layer" onClick={(e) => e.target === e.currentTarget && setEditing(false)}>
          <div className="card modal wide" role="dialog" aria-modal="true" aria-label="Mis mensajes preparados">
            <h2>Mis mensajes preparados</h2>
            <p className="muted hint">
              Son solo tuyos. Escribe <code>{"{nombre}"}</code> donde quieras el nombre del cliente y <code>{"{yo}"}</code> donde quieras el tuyo. Al
              pulsar un mensaje se pega en la caja para que lo revises antes de enviar.
            </p>
            {draft.map((t, i) => (
              <div key={i} className="tpl-edit">
                <div className="inline tpl-head">
                  <input value={t.title} maxLength={40} placeholder="Nombre corto" aria-label="Nombre del mensaje" onChange={(e) => setDraft(draft.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} />
                  <button type="button" className="btn small" onClick={() => setDraft(draft.filter((_, k) => k !== i))}>Quitar</button>
                </div>
                <textarea rows={4} value={t.text} maxLength={900} aria-label="Texto del mensaje" onChange={(e) => setDraft(draft.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} />
              </div>
            ))}
            {draft.length < 8 && <button type="button" className="btn" onClick={() => setDraft([...draft, { title: "", text: "Hola {nombre}, soy {yo}. " }])}>+ Añadir mensaje</button>}
            <div className="contact">
              <button type="button" className="btn" onClick={() => setEditing(false)}>Cancelar</button>
              <button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
