"use client";
import TierBar from "./TierBar";
import { useEffect, useState } from "react";
import Icon from "./Icon";
import { api, dayKey } from "./util";

type Origin = "Movistar" | "No Movistar";
interface Rec {
  recommended: Record<Origin, string>;
  missing: Record<Origin, number | null>;
  progress?: { have: number; steps: number[] };
}

/** Avisa a toda la app de que hay una venta nueva, para volver a mirar qué código conviene. */
export const salesChanged = () => window.dispatchEvent(new Event("sales-changed"));

/** Código recomendado ahora mismo. Se vuelve a consultar cada minuto y tras cada venta. */
function useCode(): Rec | null {
  const [rec, setRec] = useState<Rec | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<Rec>("/api/ventas/opciones")
        .then((o) => alive && setRec(o.recommended.Movistar ? o : null))
        .catch(() => {});
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 60_000);
    window.addEventListener("sales-changed", load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("sales-changed", load);
    };
  }, []);
  return rec;
}

const left = (n: number | null) =>
  n === null ? "Este código ya está en el tramo más alto." : n === 1 ? "Falta 1 venta de fibra hasta cambiar de tramo." : `Faltan ${n} ventas de fibra hasta cambiar de tramo.`;

/** Tarjeta con el código del día y las ventas de fibra que le faltan. No muestra importes. */
export default function CodeHint({ big }: { big?: boolean }) {
  const rec = useCode();
  if (!rec) return null;
  const { recommended: r, missing } = rec;
  const same = r["No Movistar"] === r.Movistar;
  return (
    <div className={big ? "code-hint big" : "code-hint"}>
      <span className="code-ico"><Icon name="target" size={big ? 20 : 15} /></span>
      <span>
        {big && <span className="muted hint block">Tu código de hoy</span>}
        {big ? <b>{r.Movistar}</b> : <>Si contrata, cárgalo en <b>{r.Movistar}</b></>}
        {!same && <> (si no viene de Movistar, <b>{r["No Movistar"]}</b>)</>}
        {big && <span className="hint block">{left(missing.Movistar)}</span>}
        {big && rec.progress && <TierBar value={rec.progress.have} steps={rec.progress.steps} label={r.Movistar} />}
      </span>
    </div>
  );
}

const ACK_KEY = "but-calls-codigo";

/**
 * Aviso en pantalla, a pantalla completa, del código en el que hay que cargar las ventas:
 * la primera vez del día (al fichar) y cada vez que pasa a convenir otro código.
 */
export function CodeGuard({ active }: { active: boolean }) {
  const rec = useCode();
  const [ack, setAck] = useState<string | null>(null);
  useEffect(() => {
    try {
      setAck(localStorage.getItem(ACK_KEY) ?? "");
    } catch {
      setAck("");
    }
  }, []);

  // Mientras dura la celebración de una venta, el aviso espera para no pisarla
  const [hold, setHold] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = () => {
      clearTimeout(t);
      setHold(true);
      t = setTimeout(() => setHold(false), 3000);
    };
    window.addEventListener("but-firmado", on);
    return () => {
      clearTimeout(t);
      window.removeEventListener("but-firmado", on);
    };
  }, []);

  if (!active || !rec || ack === null || hold) return null;
  const today = dayKey(new Date());
  const code = rec.recommended.Movistar;
  const other = rec.recommended["No Movistar"];
  const key = `${today}|${code}|${other}`;
  if (ack === key) return null;
  // Si ya había visto un código hoy y ahora es otro, es un cambio; si no, es el código del día
  const change = ack.startsWith(`${today}|`);
  const accept = () => {
    setAck(key);
    try {
      localStorage.setItem(ACK_KEY, key);
    } catch {}
  };
  return (
    <div className="overlay centered dialog-layer">
      <div className="card modal dialog code-modal" role="alertdialog" aria-modal="true" aria-label={change ? "Cambio de código" : "Tu código de hoy"}>
        <span className="big-ico"><Icon name="target" size={30} /></span>
        <p className="muted">{change ? "Cambia de código. A partir de ahora carga las ventas en:" : "Hoy carga las ventas en:"}</p>
        <h2 className="code-name">{code}</h2>
        {other !== code && <p>Si el cliente no viene de Movistar, en <b>{other}</b>.</p>}
        <p className="muted">{left(rec.missing.Movistar)}</p>
        {rec.progress && <TierBar value={rec.progress.have} steps={rec.progress.steps} label={code} />}
        <button className="btn primary big" onClick={accept}>Entendido</button>
      </div>
    </div>
  );
}
