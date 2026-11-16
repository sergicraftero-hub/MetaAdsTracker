"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";

const KEY = "but-calls-instalar";

/**
 * Aviso para instalar la app en iPhone o iPad: allí no hay botón de instalar,
 * hay que hacerlo desde Compartir → «Añadir a pantalla de inicio». Solo sale en
 * el navegador (no cuando ya está instalada) y no vuelve tras pulsar «Entendido».
 */
export default function InstallHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    const ios = /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
    const installed = nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    let seen = false;
    try {
      seen = localStorage.getItem(KEY) === "1";
    } catch {}
    setShow(ios && !installed && !seen);
  }, []);
  if (!show) return null;
  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  };
  return (
    <aside className="install" aria-label="Instalar la app en el iPhone">
      <span className="bonus-ico"><Icon name="mobile" size={20} /></span>
      <div>
        <strong>Ponla en tu iPhone como una app</strong>
        <ol>
          <li>Ábrela en Safari.</li>
          <li>Pulsa Compartir <Icon name="share" size={15} />.</li>
          <li>Elige «Añadir a pantalla de inicio».</li>
        </ol>
      </div>
      <button type="button" className="btn small" onClick={close}>Entendido</button>
    </aside>
  );
}
