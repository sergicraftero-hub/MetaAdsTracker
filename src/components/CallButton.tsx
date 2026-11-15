"use client";
import { useEffect, useState } from "react";
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

/** En móvil o tablet: pregunta cada pocos segundos si hay una llamada pedida desde el ordenador. */
export function PhoneAlerts() {
  const [alert, setAlert] = useState<CallAlert | null>(null);

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
          <a className="btn primary big" href={`tel:+${digits(alert.phone)}`} onClick={done}>Llamar</a>
        </div>
      </div>
    </div>
  );
}
