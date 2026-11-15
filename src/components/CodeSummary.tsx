"use client";
import { useEffect, useState } from "react";
import { api } from "./util";

interface Code {
  code: string;
  realCode: string;
  monthBaf: number;
  lots: number;
  lotsNext: { need: number; amount: number } | null;
  sales: number;
  commission: number;
}
interface Data {
  summary: Code[];
  plan: { code: string; why: string } | null;
}

const eur = (n: number) => `${n.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €`;

/** Resumen rápido de ventas por código, solo para dirección: fibras del mes, dinero y lo que falta para el siguiente tramo. */
export default function CodeSummary({ onOpen }: { onOpen?: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<Data>("/api/ventas")
        .then((d) => alive && setData(d))
        .catch(() => {});
    load();
    window.addEventListener("sales-changed", load);
    return () => {
      alive = false;
      window.removeEventListener("sales-changed", load);
    };
  }, []);

  const codes = data?.summary.filter((c) => c.realCode) ?? [];
  if (!data || !codes.length) return null;
  return (
    <section className="card code-summary">
      <div className="between">
        <h2>Ventas por código este mes</h2>
        {onOpen && <button className="btn small" onClick={onOpen}>Ver contrataciones</button>}
      </div>
      <div className="code-mini">
        {codes.map((c) => (
          <div key={c.realCode} className={data.plan?.code === c.code ? "mini on" : "mini"}>
            <div className="between">
              <strong>{c.code}</strong>
              <span className="bonus-num">{eur(c.commission + c.lots)}</span>
            </div>
            <span className="muted hint">{c.realCode}</span>
            <span>
              <b>{c.monthBaf}</b> fibras · {c.sales} ventas · rápel {eur(c.lots)}
            </span>
            {c.lotsNext ? (
              <>
                <div className="meter"><span style={{ width: `${(c.monthBaf / (c.monthBaf + c.lotsNext.need)) * 100}%` }} /></div>
                <span className="muted hint">Faltan {c.lotsNext.need} para {eur(c.lotsNext.amount)}</span>
              </>
            ) : (
              <span className="muted hint">En el tramo más alto</span>
            )}
          </div>
        ))}
      </div>
      {data.plan?.code && <p className="muted hint">Las próximas ventas, en <b>{data.plan.code}</b>. {data.plan.why}</p>}
    </section>
  );
}
