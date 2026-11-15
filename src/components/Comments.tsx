"use client";
import { useEffect, useState } from "react";
import type { Comment } from "@/lib/types";

const MAX = 4 * 1024 * 1024;

/** Guarda una nota (y un archivo opcional) como comentario de la página del lead en Notion. */
export async function postComment(leadId: string, text: string, file?: File | null): Promise<Comment[]> {
  if (file && file.size > MAX) throw new Error("El archivo supera los 4 MB");
  const form = new FormData();
  form.append("text", text);
  if (file) form.append("file", file);
  const res = await fetch(`/api/leads/${leadId}/comentarios`, { method: "POST", body: form }).catch(() => null);
  const j = await res?.json().catch(() => ({}));
  if (!res?.ok) throw new Error(j?.error ?? "Sin conexión");
  return j.comments as Comment[];
}

const when = (iso: string) => new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Notas del lead: el hilo de comentarios de su página en Notion, con caja para añadir otra. */
export default function Comments({ leadId, compose, toast }: { leadId: string; compose: boolean; toast: (m: string, e?: boolean) => void }) {
  const [list, setList] = useState<Comment[] | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileKey, setFileKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setList(null);
    setError("");
    fetch(`/api/leads/${leadId}/comentarios`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok) setList(j.comments);
        else setError(j.error ?? "No se pudieron cargar las notas");
      })
      .catch(() => alive && setError("Sin conexión: no se pueden cargar las notas"));
    return () => {
      alive = false;
    };
  }, [leadId]);

  async function send() {
    setBusy(true);
    try {
      setList(await postComment(leadId, text, file));
      setText("");
      setFile(null);
      setFileKey((k) => k + 1);
      toast(file ? "Nota y archivo guardados en Notion" : "Nota guardada en Notion");
    } catch (e) {
      toast(`No se guardó: ${(e as Error).message}`, true);
    }
    setBusy(false);
  }

  return (
    <div className="notes">
      {error ? (
        <p className="error hint">{error}</p>
      ) : list === null ? (
        <p className="muted hint">Cargando notas…</p>
      ) : list.length === 0 ? (
        <p className="muted hint">Sin notas todavía.</p>
      ) : (
        <ul className="thread">
          {list.map((c) => (
            <li key={c.id}>
              <span className="muted hint">
                {c.author || "—"} · {when(c.at)}
              </span>
              {c.text && <span className="note-text">{c.text}</span>}
              {c.files.map((f, i) => (
                <a key={i} className="file" href={f.url} target="_blank" rel="noreferrer">
                  📎 {f.name}
                </a>
              ))}
            </li>
          ))}
        </ul>
      )}
      {compose && (
        <div className="compose">
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe una nota" aria-label="Nueva nota" />
          <label className="attach">
            Adjuntar archivo (contrato, hasta 4 MB)
            <input key={fileKey} type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <button className="btn primary small" disabled={busy || (!text.trim() && !file)} onClick={send}>
            {busy ? "Guardando…" : "Guardar nota"}
          </button>
        </div>
      )}
    </div>
  );
}
