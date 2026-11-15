"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LeadsPayload, Product, Sale, SaleOrigin } from "@/lib/types";
import { useDialogs } from "./Dialogs";
import Icon from "./Icon";
import { api, dayKey } from "./util";

type Toast = (m: string, e?: boolean) => void;

interface CodeSummary {
  code: string;
  realCode: string;
  monthBaf: number;
  lots: number;
  lotsNext: { need: number; amount: number } | null;
  quarterBaf: number;
  quarter: number;
  quarterNext: { need: number; amount: number } | null;
  sales: number;
  commission: number;
}
interface Data {
  month: string;
  sales: Sale[];
  summary: CodeSummary[];
  sellers: { name: string; sales: number; fibers: number; commission: number }[];
  totals: { commission: number; lots: number; quarter: number };
  catalog: Product[];
  codes: { alias: string; real: string }[];
  estados: string[];
  /** Filas «BONO…» apuntadas a mano en Notion que no se cuentan */
  ignored: number;
}

const eur = (n: number) => `${n.toLocaleString("es-ES", { maximumFractionDigits: 2 })} €`;
const pad = (n: number) => String(n).padStart(2, "0");
const monthName = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
const shiftMonth = (m: string, by: number) => {
  const d = new Date(`${m}-01T12:00:00`);
  d.setMonth(d.getMonth() + by);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const day = (d: string) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "—");

/** Backoffice de contrataciones para dirección: dinero por código y por comercial, y edición de cada venta. */
export default function Contracts({ toast }: { data: LeadsPayload; toast: Toast }) {
  const dlg = useDialogs();
  const [month, setMonth] = useState(dayKey(new Date()).slice(0, 7));
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<Sale | null>(null);
  const [preview, setPreview] = useState<Sale | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<Data>(`/api/ventas?mes=${month}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [month]);
  useEffect(() => {
    load();
  }, [load]);

  const byId = useMemo(() => new Map((data?.catalog ?? []).map((p) => [p.id, p])), [data]);

  async function save() {
    if (!edit) return;
    setBusy(true);
    try {
      await api(`/api/ventas/${edit.id}`, "PATCH", edit);
      toast("Contratación actualizada");
      setEdit(null);
      await load();
    } catch (e) {
      toast((e as Error).message, true);
    }
    setBusy(false);
  }

  async function addCode() {
    const v = await dlg.form({
      title: "Añadir código de carga",
      text: "Escribe el nombre real del código tal como lo usáis (por ejemplo «LT001234 Nombre»). Los comerciales solo verán «Código N».",
      ok: "Añadir",
      fields: [{ key: "name", label: "Nombre del código", required: true }],
    });
    if (!v) return;
    try {
      await api("/api/ventas/opciones", "POST", { name: v.name });
      toast("Código añadido");
      await load();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  if (error && !data) return <section className="card"><p className="error">{error}</p><button className="btn" onClick={load}>Reintentar</button></section>;
  if (!data) return <p className="muted">Cargando contrataciones…</p>;

  const total = data.totals.commission + data.totals.lots;
  const setProducts = (products: string[]) => edit && setEdit({ ...edit, products, commission: products.reduce((a, id) => a + (byId.get(id)?.commission ?? 0), 0) });

  return (
    <div className="stack">
      <div className="filters">
        <div className="month-nav">
          <button className="btn small" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mes anterior"><Icon name="left" size={16} /></button>
          <strong className="cap">{monthName(month)}</strong>
          <button className="btn small" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mes siguiente"><Icon name="right" size={16} /></button>
        </div>
      </div>

      <div className="tiles kpis">
        <div className="tile hero">
          <span className="tile-label">Generado este mes</span>
          <span className="tile-value">{eur(total)}</span>
          <span className="tile-sub">comisiones más extra por lotes</span>
        </div>
        <div className="tile"><span className="tile-label">Comisiones</span><span className="tile-value">{eur(data.totals.commission)}</span><span className="muted tile-sub">{data.sales.filter((s) => !s.baja).length} ventas</span></div>
        <div className="tile"><span className="tile-label">Extra por lotes</span><span className="tile-value">{eur(data.totals.lots)}</span><span className="muted tile-sub">según fibras de cada código</span></div>
        <div className="tile"><span className="tile-label">Extra trimestral</span><span className="tile-value">{eur(data.totals.quarter)}</span><span className="muted tile-sub">trimestre en curso, sin origen Movistar</span></div>
        <div className="tile"><span className="tile-label">Pendiente de cobrar</span><span className="tile-value">{eur(data.sales.filter((s) => !s.paid).reduce((a, s) => a + (s.commission ?? 0), 0))}</span><span className="muted tile-sub">comisiones sin marcar como cobradas</span></div>
      </div>

      <section className="card">
        <div className="between">
          <h2>Por código</h2>
          <button className="btn small" onClick={addCode}>Añadir código</button>
        </div>
        <div className="codes">
          {data.summary.map((c) => (
            <div key={c.realCode || "none"} className="code-card">
              <div className="between">
                <strong>{c.code}</strong>
                <span className="bonus-num">{eur(c.commission + c.lots)}</span>
              </div>
              <span className="muted hint">{c.realCode || "Ventas que aún no tienen código de carga"}</span>
              <div className="code-line">
                <span>Lotes del mes: <b>{c.monthBaf}</b> fibras · {eur(c.lots)}</span>
                {c.lotsNext && (
                  <>
                    <div className="meter"><span style={{ width: `${(c.monthBaf / (c.monthBaf + c.lotsNext.need)) * 100}%` }} /></div>
                    <span className="muted hint">Faltan {c.lotsNext.need} para {eur(c.lotsNext.amount)}</span>
                  </>
                )}
              </div>
              <div className="code-line">
                <span>Trimestre (sin Movistar): <b>{c.quarterBaf}</b> fibras · {eur(c.quarter)}</span>
                {c.quarterNext && (
                  <>
                    <div className="meter"><span style={{ width: `${(c.quarterBaf / (c.quarterBaf + c.quarterNext.need)) * 100}%` }} /></div>
                    <span className="muted hint">Faltan {c.quarterNext.need} para {eur(c.quarterNext.amount)}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="muted hint">
          Cuentan para las extras las fibras de primera residencia que no estén de baja. Las contrataciones antiguas, que no decían el origen ni la
          residencia, se cuentan como de Movistar y de primera residencia hasta que las edites.
          {data.ignored > 0 && ` En «Seguimiento O2» hay ${data.ignored} filas de bonos apuntados a mano («BONO…») que no se suman aquí, porque la app ya calcula los lotes.`}
        </p>
      </section>

      <section className="card">
        <h2>Por comercial</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Comercial</th><th>Ventas</th><th>Fibras</th><th>Comisiones</th></tr></thead>
            <tbody>
              {data.sellers.map((s) => (
                <tr key={s.name}><th scope="row">{s.name}</th><td>{s.sales}</td><td>{s.fibers}</td><td>{eur(s.commission)}</td></tr>
              ))}
              {data.sellers.length === 0 && <tr><td colSpan={4} className="muted">Sin ventas este mes.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Contrataciones <span className="count">{data.sales.length}</span></h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Cliente</th><th>Comercial</th><th>Código</th><th>Productos</th><th>Estado</th><th>Comisión</th><th></th></tr>
            </thead>
            <tbody>
              {data.sales.map((s) => (
                <tr key={s.id} className={s.baja ? "is-baja" : ""}>
                  <td>{day(s.date)}</td>
                  <th scope="row">{s.name || "—"}</th>
                  <td>{s.comercial || "—"}</td>
                  <td>{s.code || "—"}</td>
                  <td className="left">
                    {s.products.length ? s.products.map((id) => byId.get(id)?.name ?? id).join(" + ") : <span className="muted">Sin detallar</span>}
                    <span className="muted hint block">
                      {s.origin === "Movistar" ? "De Movistar" : "No Movistar"}
                      {s.primary ? " · 1.ª residencia" : " · no cuenta para extras"}
                    </span>
                  </td>
                  <td className="left">
                    <span className="result-cell">
                      {s.state || "—"}
                      {s.baja && <span className="pill warn">Baja</span>}
                      {s.paid && <span className="pill on">Cobrado</span>}
                    </span>
                  </td>
                  <td>{eur(s.commission ?? 0)}</td>
                  <td className="cell-actions">
                    {s.contract && <button className="btn small" onClick={() => setPreview(s)}>Contrato</button>}
                    <button className="btn small" onClick={() => setEdit({ ...s })}>Editar</button>
                  </td>
                </tr>
              ))}
              {data.sales.length === 0 && <tr><td colSpan={8} className="muted">Sin contrataciones este mes.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {edit && (
        <div className="overlay centered" onClick={(e) => e.target === e.currentTarget && setEdit(null)}>
          <div className="card modal wide" role="dialog" aria-modal="true" aria-label="Editar contratación">
            <h2>Editar contratación</h2>
            <div className="grid2">
              <label>Cliente<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
              <label>DNI<input value={edit.dni} onChange={(e) => setEdit({ ...edit, dni: e.target.value })} /></label>
              <label>Teléfono<input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></label>
              <label>Comercial<input value={edit.comercial} onChange={(e) => setEdit({ ...edit, comercial: e.target.value })} /></label>
              <label>Fecha de firma<input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></label>
              <label>
                Código de carga
                <select value={edit.realCode ?? ""} onChange={(e) => setEdit({ ...edit, realCode: e.target.value })}>
                  <option value="">Sin código</option>
                  {data.codes.map((c) => <option key={c.real} value={c.real}>{c.alias} · {c.real}</option>)}
                </select>
              </label>
              <label>
                Estado
                <select value={edit.state} onChange={(e) => setEdit({ ...edit, state: e.target.value })}>
                  {!data.estados.includes(edit.state) && <option value={edit.state}>{edit.state || "—"}</option>}
                  {data.estados.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label>
                Origen
                <select value={edit.origin} onChange={(e) => setEdit({ ...edit, origin: e.target.value as SaleOrigin })}>
                  <option>Movistar</option>
                  <option>No Movistar</option>
                </select>
              </label>
              <label>Instalación de la fibra<input type="date" value={edit.installFiber} onChange={(e) => setEdit({ ...edit, installFiber: e.target.value })} /></label>
              <label>Portabilidad<input type="date" value={edit.installPort} onChange={(e) => setEdit({ ...edit, installPort: e.target.value })} /></label>
            </div>

            <div className="field">
              <span className="label">Productos</span>
              {edit.products.length > 0 && (
                <ul className="prod-list">
                  {edit.products.map((id, i) => (
                    <li key={`${id}-${i}`}>
                      <span><b>{byId.get(id)?.name ?? id}</b><small>{byId.get(id)?.family} · {eur(byId.get(id)?.commission ?? 0)}</small></span>
                      <button type="button" className="btn small" aria-label="Quitar producto" onClick={() => setProducts(edit.products.filter((_, k) => k !== i))}><Icon name="x" size={14} /></button>
                    </li>
                  ))}
                </ul>
              )}
              <select value="" aria-label="Añadir producto" onChange={(e) => e.target.value && setProducts([...edit.products, e.target.value])}>
                <option value="">+ Añadir producto</option>
                {[...new Set(data.catalog.map((p) => p.family))].map((fam) => (
                  <optgroup key={fam} label={fam}>
                    {data.catalog.filter((p) => p.family === fam).map((p) => <option key={p.id} value={p.id}>{p.name} · comisión {p.commission} €</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="grid2">
              <label>
                Comisión (€)
                <input type="number" min={0} step={1} value={edit.commission ?? 0} onChange={(e) => setEdit({ ...edit, commission: Number(e.target.value) })} />
                <span className="muted hint">Se calcula con los productos; puedes corregirla a mano.</span>
              </label>
              <div className="field">
                <label className="check"><input type="checkbox" checked={edit.primary} onChange={(e) => setEdit({ ...edit, primary: e.target.checked })} />Primera residencia</label>
                <label className="check"><input type="checkbox" checked={!!edit.paid} onChange={(e) => setEdit({ ...edit, paid: e.target.checked })} />Cobrado</label>
                <label className="check"><input type="checkbox" checked={edit.baja} onChange={(e) => setEdit({ ...edit, baja: e.target.checked })} />Baja (deja de contar)</label>
              </div>
            </div>
            <label>Comentarios<textarea rows={2} value={edit.comments} onChange={(e) => setEdit({ ...edit, comments: e.target.value })} /></label>
            <div className="contact">
              <button className="btn" onClick={() => setEdit(null)}>Cancelar</button>
              <button className="btn primary" disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="overlay centered" onClick={(e) => e.target === e.currentTarget && setPreview(null)}>
          <div className="card modal preview" role="dialog" aria-modal="true" aria-label={`Contrato de ${preview.name}`}>
            <div className="between">
              <h2>Contrato de {preview.name}</h2>
              <div className="quick">
                <a className="btn small" href={`/api/ventas/${preview.id}/contrato`} target="_blank" rel="noreferrer">Abrir aparte</a>
                <button className="btn small" onClick={() => setPreview(null)}>Cerrar</button>
              </div>
            </div>
            {/\.(png|jpe?g|webp)$/i.test(preview.contract) ? (
              <img src={`/api/ventas/${preview.id}/contrato`} alt={`Contrato de ${preview.name}`} />
            ) : (
              <iframe src={`/api/ventas/${preview.id}/contrato`} title={`Contrato de ${preview.name}`} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
