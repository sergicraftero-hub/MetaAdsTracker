"use client";
import { useEffect, useMemo, useState } from "react";
import type { ContractData, Lead, Product, Sale, SaleOrigin } from "@/lib/types";
import Icon from "./Icon";
import { api, str } from "./util";

type Toast = (m: string, e?: boolean) => void;
interface Options {
  catalog: Product[];
  codes: string[];
  recommended: Record<SaleOrigin, string>;
  sale: Sale | null;
}

const MAX = 4 * 1024 * 1024;

/** Resumen de una contratación ya registrada, sin importes. */
export function SaleSummary({ sale, catalog }: { sale: Sale; catalog: Product[] }) {
  const name = (id: string) => {
    const p = catalog.find((x) => x.id === id);
    return p ? `${p.family}: ${p.name}` : id;
  };
  return (
    <div className="sale-summary">
      <ul>
        {sale.products.map((id, i) => <li key={i}>{name(id)}</li>)}
        {sale.products.length === 0 && <li className="muted">Sin productos indicados</li>}
      </ul>
      <span className="muted hint">
        {sale.code || "Sin código"} · {sale.origin === "Movistar" ? "viene de Movistar" : "no viene de Movistar"}
        {sale.primary ? " · primera residencia" : ""}
        {sale.contract ? " · contrato adjunto" : ""}
      </span>
    </div>
  );
}

/**
 * Formulario de contratación tras un «Firmado»: el comercial sube el contrato (la app lo lee y rellena lo que puede),
 * revisa los productos, marca si es primera residencia y elige el código en el que carga la venta.
 * No muestra ningún importe.
 */
export default function SaleForm({ lead, toast, onDone, submitLabel = "Guardar contratación" }: { lead: Lead; toast: Toast; onDone?: (sale: Sale, file: File | null) => void; submitLabel?: string }) {
  const [opts, setOpts] = useState<Options | null>(null);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<string[]>([]);
  const [origin, setOrigin] = useState<SaleOrigin>("Movistar");
  const [primary, setPrimary] = useState(true);
  const [code, setCode] = useState("");
  const [codeFromContract, setCodeFromContract] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [read, setRead] = useState<ContractData | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Options>(`/api/ventas/opciones?lead=${lead.id}`)
      .then((o) => {
        setOpts(o);
        setCode(o.recommended.Movistar || o.codes[0] || "");
      })
      .catch((e) => setError((e as Error).message));
  }, [lead.id]);

  const byId = useMemo(() => new Map((opts?.catalog ?? []).map((p) => [p.id, p])), [opts]);
  const families = useMemo(() => [...new Set((opts?.catalog ?? []).map((p) => p.family))], [opts]);
  const hasFiber = products.some((id) => byId.get(id)?.baf);
  const recommended = opts?.recommended[origin] ?? "";

  // Mientras el código no venga del contrato, sigue a la recomendación
  useEffect(() => {
    if (!codeFromContract && recommended) setCode(recommended);
  }, [recommended, codeFromContract]);

  async function onFile(f: File | null) {
    setFile(f);
    setRead(null);
    if (!f) return;
    if (f.size > MAX) return toast("El contrato supera los 4 MB", true);
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return; // una foto se adjunta, pero no se puede leer
    setReading(true);
    const form = new FormData();
    form.append("file", f);
    const res = await fetch("/api/ventas/contrato", { method: "POST", body: form }).catch(() => null);
    const j = await res?.json().catch(() => ({}));
    setReading(false);
    if (!res?.ok) return toast(j?.error ?? "No se pudo leer el contrato; rellena los datos a mano", true);
    const c = j.contract as ContractData;
    setRead(c);
    if (c.products.length) setProducts(c.products);
    setOrigin(c.origin);
    if (c.code) {
      setCode(c.code);
      setCodeFromContract(true);
    }
    toast("Contrato leído: revisa los datos");
  }

  async function submit() {
    if (!products.length) return toast("Añade al menos un producto", true);
    if (!code) return toast("Elige el código", true);
    setBusy(true);
    const form = new FormData();
    form.append("leadId", lead.id);
    form.append("products", JSON.stringify(products));
    form.append("origin", origin);
    form.append("primary", String(hasFiber && primary));
    form.append("code", code);
    if (read) {
      form.append("name", read.name);
      form.append("dni", read.dni);
      form.append("phone", read.phone);
      form.append("date", read.date);
    }
    if (file) form.append("file", file);
    const res = await fetch("/api/ventas", { method: "POST", body: form }).catch(() => null);
    const j = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return toast(j?.error ?? "No se pudo guardar la contratación", true);
    toast("Contratación guardada");
    setOpts((o) => (o ? { ...o, sale: j.sale } : o));
    onDone?.(j.sale, file);
  }

  if (error) {
    return (
      <div className="sale-form">
        <p className="error hint">{error}</p>
        {onDone && <button className="btn" onClick={() => onDone({ id: "", products: [] } as unknown as Sale, null)}>Continuar sin registrar la venta</button>}
      </div>
    );
  }
  if (!opts) return <p className="muted hint">Cargando…</p>;
  if (opts.sale) {
    return (
      <div className="sale-form">
        <SaleSummary sale={opts.sale} catalog={opts.catalog} />
        {onDone && <button className="btn primary" onClick={() => onDone(opts.sale!, null)}>Continuar</button>}
      </div>
    );
  }

  return (
    <div className="sale-form">
      <label>
        Contrato firmado (PDF)
        <input type="file" accept="application/pdf,image/*" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        <span className="muted hint">{reading ? "Leyendo el contrato…" : "Súbelo y la app rellena sola los datos que pueda."}</span>
      </label>
      {read && (
        <p className="notice read">
          <Icon name="check" size={16} /> Leído del contrato: {read.name || "cliente"}
          {read.dni ? ` · ${read.dni}` : ""}
          {read.date ? ` · firmado el ${new Date(`${read.date}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}` : ""}
        </p>
      )}

      <div className="field">
        <span className="label">Qué ha contratado</span>
        {products.length > 0 && (
          <ul className="prod-list">
            {products.map((id, i) => {
              const p = byId.get(id);
              return (
                <li key={`${id}-${i}`}>
                  <span>
                    <b>{p?.name ?? id}</b>
                    <small>{p?.family}</small>
                  </span>
                  <button type="button" className="btn small" aria-label={`Quitar ${p?.name ?? id}`} onClick={() => setProducts(products.filter((_, k) => k !== i))}>
                    <Icon name="x" size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <select
          value=""
          aria-label="Añadir producto"
          onChange={(e) => {
            if (e.target.value) setProducts([...products, e.target.value]);
          }}
        >
          <option value="">{products.length ? "+ Añadir otro producto" : "+ Añadir producto"}</option>
          {families.map((fam) => (
            <optgroup key={fam} label={fam}>
              {opts.catalog.filter((p) => p.family === fam).map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.price} €/mes</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="label">De dónde viene el cliente</span>
        <div className="seg" role="group" aria-label="Origen del cliente">
          {(["Movistar", "No Movistar"] as const).map((o) => (
            <button key={o} type="button" className={origin === o ? "active" : ""} onClick={() => setOrigin(o)}>
              {o === "Movistar" ? "De Movistar" : "De otra compañía o alta nueva"}
            </button>
          ))}
        </div>
      </div>

      {hasFiber && (
        <label className="check">
          <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} />
          La fibra es para su vivienda habitual (primera residencia)
        </label>
      )}

      <label>
        Código en el que se carga la venta
        <select
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setCodeFromContract(true);
          }}
        >
          {opts.codes.map((c) => (
            <option key={c} value={c}>
              {c}
              {c === recommended ? " (recomendado)" : ""}
            </option>
          ))}
        </select>
        <span className="muted hint">
          {read?.code ? `El contrato está cargado en ${read.code}.` : recommended ? `Ahora mismo conviene cargarla en ${recommended}.` : ""}
        </span>
      </label>

      <button type="button" className="btn primary" disabled={busy || reading || !products.length} onClick={submit}>
        {busy ? "Guardando…" : submitLabel}
      </button>
      <span className="muted hint">Lead: {str(lead.f.nombre)}</span>
    </div>
  );
}
