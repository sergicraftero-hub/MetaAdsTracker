"use client";
import { useEffect, useRef, useState } from "react";
import type { CallAlert, Lead } from "@/lib/types";
import { api, digits, str, telHref } from "./util";

/** ¿Es un móvil o una tablet? (pantalla táctil como puntero principal) */
export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

interface Props {
  lead: Lead;
  className?: string;
  toast: (m: string, e?: boolean) => void;
  onCall?: () => void;
  children: React.ReactNode;
  label?: string;
}

/**
 * Botón de llamar. En móvil o tablet marca el número directamente.
 * En ordenador envía un aviso al móvil del mismo usuario, que llama al aceptarlo.
 */
export default function CallButton({ lead, className = "btn primary", toast, onCall, children, label }: Props) {
  const [touch, setTouch] = useState(true);
  useEffect(() => setTouch(isTouchDevice()), []);

  if (touch) {
    return (
      <a className={className} href={telHref(lead.f.telefono)} onClick={onCall} aria-label={label}>
        {children}
      </a>
    );
  }
  return (
    <button
      className={className}
      aria-label={label}
      onClick={async () => {
        onCall?.();
        try {
          await api("/api/avisos", "POST", { leadId: lead.id });
          toast(`Aviso enviado a tu móvil: acéptalo allí para llamar a ${str(lead.f.nombre)}`);
        } catch (e) {
          toast((e as Error).message, true);
        }
      }}
    >
      {children}
    </button>
  );
}

/**
 * Cronómetro de «tiempo fuera de la app»: al pulsar Llamar en el móvil se abre el marcador y la app
 * pasa a segundo plano; lo que tarda en volver es la duración real aproximada de la llamada.
 * `onReturn` recibe los segundos acumulados cada vez que el usuario vuelve a la app.
 */
export function useAwayTimer(onReturn?: (seconds: number) => void) {
  const t = useRef<{ on: boolean; hiddenAt: number | null; total: number }>({ on: false, hiddenAt: null, total: 0 });
  const cb = useRef(onReturn);
  cb.current = onReturn;
  useEffect(() => {
    const onVis = () => {
      const s = t.current;
      if (!s.on) return;
      if (document.visibilityState === "hidden") s.hiddenAt = Date.now();
      else if (s.hiddenAt) {
        s.total += Date.now() - s.hiddenAt;
        s.hiddenAt = null;
        cb.current?.(Math.round(s.total / 1000));
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return {
    /** Empieza a medir (solo tiene sentido en móvil o tablet, donde llamar saca de la app) */
    start: () => {
      if (isTouchDevice()) t.current.on = true;
    },
    read: () => Math.round(t.current.total / 1000),
    reset: () => {
      t.current = { on: false, hiddenAt: null, total: 0 };
    },
  };
}

/** En móvil o tablet: pregunta cada pocos segundos si hay una llamada pedida desde el ordenador. */
export function PhoneAlerts() {
  const [alert, setAlert] = useState<CallAlert | null>(null);
  const accepted = useRef<string | null>(null);
  // Tras aceptar la llamada, al volver a la app se apunta en el aviso cuánto ha durado
  const timer = useAwayTimer((seconds) => {
    if (accepted.current) api("/api/avisos", "PATCH", { id: accepted.current, away: seconds }).catch(() => {});
  });

  useEffect(() => {
    if (!isTouchDevice()) return;
    const seen = new Set<string>();
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { alerts } = await api<{ alerts: CallAlert[] }>("/api/avisos");
        const next = alerts.find((a) => !seen.has(a.id));
        if (next) {
          seen.add(next.id);
          setAlert(next);
        }
      } catch {}
    };
    check();
    const timer = setInterval(check, 5000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  if (!alert) return null;
  const done = () => {
    fetch(`/api/avisos?id=${alert.id}`, { method: "DELETE" }).catch(() => {});
    setAlert(null);
  };
  return (
    <div className="overlay centered top-layer">
      <div className="card modal" role="alertdialog" aria-modal="true" aria-label="Llamada pedida desde el ordenador">
        <p className="muted hint">Llamada pedida desde tu ordenador</p>
        <h2 className="lead-name">{alert.name || "Lead"}</h2>
        <p className="muted">{alert.phone}</p>
        <div className="contact">
          <button className="btn big" onClick={done}>Ignorar</button>
          <a
            className="btn primary big"
            href={`tel:+${digits(alert.phone)}`}
            onClick={() => {
              accepted.current = alert.id;
              timer.reset();
              timer.start();
              setAlert(null);
            }}
          >
            Llamar
          </a>
        </div>
      </div>
    </div>
  );
}
