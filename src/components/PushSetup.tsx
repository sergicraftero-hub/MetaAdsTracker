"use client";
import { useEffect, useState } from "react";
import { api } from "./util";

type Toast = (m: string, e?: boolean) => void;

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Activa en este dispositivo las notificaciones push, que llegan aunque la app esté cerrada.
 * Solo se envían las importantes: rellamada que toca, fin de jornada y jornada sin cerrar.
 */
export default function PushSetup({ toast }: { toast: Toast }) {
  const [state, setState] = useState<"cargando" | "no-soportado" | "bloqueado" | "apagado" | "activo">("cargando");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("no-soportado");
      if (Notification.permission === "denied") return setState("bloqueado");
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const sub = await reg?.pushManager.getSubscription().catch(() => null);
      setState(sub && Notification.permission === "granted" ? "activo" : "apagado");
    })();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "bloqueado" : "apagado");
        throw new Error("No has dado permiso para las notificaciones");
      }
      const { key, ready } = await api<{ key: string; ready: boolean }>("/api/push");
      if (!ready) throw new Error("Falta la página «BUT Calls» en Notion");
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
      await api("/api/push", "POST", { subscription: sub.toJSON() });
      setState("activo");
      await api("/api/push/test", "POST");
      toast("Notificaciones activadas. Te hemos enviado una de prueba.");
    } catch (e) {
      toast((e as Error).message || "No se pudieron activar", true);
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api("/api/push", "DELETE", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("apagado");
      toast("Notificaciones desactivadas en este dispositivo");
    } catch (e) {
      toast((e as Error).message, true);
    }
    setBusy(false);
  }

  if (state === "cargando") return null;
  return (
    <div className="push-box">
      <strong>Notificaciones en este dispositivo</strong>
      {state === "no-soportado" && (
        <span className="muted hint">
          Este navegador no las admite. En iPhone, primero añade la app a la pantalla de inicio (Safari → Compartir → «Añadir a pantalla de inicio») y
          ábrela desde ahí.
        </span>
      )}
      {state === "bloqueado" && <span className="muted hint">Están bloqueadas. Actívalas en los ajustes del navegador o del móvil para esta app.</span>}
      {state === "apagado" && (
        <>
          <span className="muted hint">Te avisamos aunque tengas la app cerrada, solo de lo importante: una rellamada que toca, el fin de tu jornada o si te dejas la jornada abierta.</span>
          <button className="btn primary small" disabled={busy} onClick={enable}>{busy ? "Activando…" : "Activar notificaciones"}</button>
        </>
      )}
      {state === "activo" && (
        <>
          <span className="muted hint">Activadas. Llegan aunque la app esté cerrada.</span>
          <div className="quick">
            <button className="btn small" disabled={busy} onClick={() => api("/api/push/test", "POST").then(() => toast("Prueba enviada")).catch((e) => toast((e as Error).message, true))}>Enviar prueba</button>
            <button className="btn small" disabled={busy} onClick={disable}>Desactivar</button>
          </div>
        </>
      )}
    </div>
  );
}
