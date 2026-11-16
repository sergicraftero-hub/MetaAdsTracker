"use client";
import { useCallback, useEffect, useState } from "react";
import Empty from "./Empty";
import Icon from "./Icon";
import { api } from "./util";

type Toast = (m: string, e?: boolean) => void;
interface Row {
  alias: string;
  real: string;
  user: string;
  password: string;
  url: string;
}
interface Key {
  user: string;
  password: string;
  url: string;
}

/** Pestaña Claves (solo dirección): usuario, contraseña y enlace del portal de cada código de carga. */
export default function Keys({ toast }: { toast: Toast }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState("");
  const [shown, setShown] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    api<{ codes: Row[] }>("/api/claves")
      .then((d) => setRows(d.codes))
      .catch((e) => {
        toast((e as Error).message, true);
        setRows([]);
      });
  }, [toast]);
  useEffect(load, [load]);

  const edit = (real: string, patch: Partial<Row>) => setRows((r) => r?.map((x) => (x.real === real ? { ...x, ...patch } : x)) ?? r);

  async function save(r: Row) {
    setBusy(r.real);
    try {
      await api("/api/claves", "PUT", { real: r.real, user: r.user, password: r.password, url: r.url });
      toast(`Claves de ${r.alias} guardadas`);
    } catch (e) {
      toast((e as Error).message, true);
    }
    setBusy("");
  }

  if (!rows) return <p className="muted">Cargando…</p>;
  return (
    <div className="stack">
      <section className="card">
        <h2>Claves de los códigos</h2>
        <p className="muted">
          El usuario y la contraseña con los que se carga el contrato en cada código. El comercial los ve al pulsar el botón del código en la
          ficha del lead; no ve el nombre real del código. Se guardan cifradas.
        </p>
        {rows.length === 0 && <Empty small title="Aún no hay códigos" text="Se añaden en Contratos → «Añadir código»." />}
        <div className="codes">
          {rows.map((r) => (
            <form
              key={r.real}
              className="code-card"
              onSubmit={(e) => {
                e.preventDefault();
                save(r);
              }}
            >
              <div className="between">
                <strong>{r.alias}</strong>
                <span className="muted hint">{r.real}</span>
              </div>
              <label>
                Usuario
                <input value={r.user} autoComplete="off" onChange={(e) => edit(r.real, { user: e.target.value })} />
              </label>
              <label>
                Contraseña
                <span className="inline">
                  <input type={shown.has(r.real) ? "text" : "password"} value={r.password} autoComplete="new-password" onChange={(e) => edit(r.real, { password: e.target.value })} />
                  <button
                    type="button"
                    className="btn small"
                    onClick={() =>
                      setShown((s) => {
                        const n = new Set(s);
                        if (n.has(r.real)) n.delete(r.real);
                        else n.add(r.real);
                        return n;
                      })
                    }
                  >
                    {shown.has(r.real) ? "Ocultar" : "Ver"}
                  </button>
                </span>
              </label>
              <label>
                Enlace del portal (opcional)
                <input type="url" placeholder="https://…" value={r.url} onChange={(e) => edit(r.real, { url: e.target.value })} />
              </label>
              <button className="btn primary" disabled={busy === r.real}>{busy === r.real ? "Guardando…" : "Guardar"}</button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Ventana con las claves de un código, para el comercial: usuario y contraseña con botón de copiar. */
export function KeyDialog({ code, onClose, toast }: { code: string; onClose: () => void; toast?: Toast }) {
  const [state, setState] = useState<{ key: Key | null } | "error" | null>(null);
  useEffect(() => {
    api<{ key: Key | null }>(`/api/claves?codigo=${encodeURIComponent(code)}`)
      .then(setState)
      .catch(() => setState("error"));
  }, [code]);
  const copy = (text: string, what: string) =>
    navigator.clipboard
      ?.writeText(text)
      .then(() => toast?.(`${what} copiada`))
      .catch(() => {});
  const key = state && state !== "error" ? state.key : null;
  return (
    <div className="overlay centered dialog-layer" onClick={onClose}>
      <div className="card modal dialog key-modal" role="dialog" aria-modal="true" aria-label={`Claves de ${code}`} onClick={(e) => e.stopPropagation()}>
        <span className="big-ico"><Icon name="key" size={28} /></span>
        <h2 className="code-name">{code}</h2>
        {state === null && <p className="muted">Cargando…</p>}
        {state === "error" && <p className="error">No se han podido cargar las claves.</p>}
        {state && state !== "error" && !key && <p className="muted">Dirección aún no ha puesto las claves de este código.</p>}
        {key && (
          <dl className="key-list">
            <div>
              <dt>Usuario</dt>
              <dd>{key.user || "—"}</dd>
              {key.user && <button type="button" className="btn small" onClick={() => copy(key.user, "Usuario")}>Copiar</button>}
            </div>
            <div>
              <dt>Contraseña</dt>
              <dd>{key.password || "—"}</dd>
              {key.password && <button type="button" className="btn small" onClick={() => copy(key.password, "Contraseña")}>Copiar</button>}
            </div>
          </dl>
        )}
        {key?.url && <a className="btn primary" href={key.url} target="_blank" rel="noreferrer">Abrir el portal</a>}
        <button type="button" className="btn" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
