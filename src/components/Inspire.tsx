"use client";
import { useState } from "react";

const PHRASES = [
  "Cada llamada es una puerta. Alguna se abre hoy.",
  "El no ya lo tienes. Ve a por el sí.",
  "La constancia vende más que el talento.",
  "Una llamada más. Ahí suele estar la venta.",
  "Escucha primero. La venta viene después.",
  "Hoy alguien necesita justo lo que ofreces.",
  "Las grandes semanas se hacen llamada a llamada.",
  "Sonríe al hablar: se nota al otro lado.",
  "No cuentes las llamadas. Haz que cuenten.",
  "El siguiente puede ser el bueno.",
  "Quien insiste con educación, llega.",
  "Paso a paso también se sube la montaña.",
  "Un buen día empieza con la primera llamada.",
  "La confianza se contagia. Empieza por la tuya.",
  "Cada cliente es una historia. Pregunta por la suya.",
  "Lo difícil de hoy es lo fácil de mañana.",
  "Despacio y bien: así se firma.",
  "Detrás de cada número hay una persona.",
  "La suerte suele descolgar a quien más llama.",
  "Termina el día mejor de como lo empezaste.",
  "Hazlo sencillo. Hazlo bien. Hazlo otra vez.",
  "El equipo gana cuando cada uno da un paso más.",
];
const SCENES = ["amanecer", "cumbre", "mar"] as const;

const dayNumber = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);

/**
 * Lámina con una frase para animar, dibujada solo con HTML y CSS (sin imágenes).
 * Cambia cada día y con cada llamada hecha; al tocarla, pasa a la siguiente.
 */
export default function Inspire({ seed = 0 }: { seed?: number }) {
  const [extra, setExtra] = useState(0);
  const n = dayNumber() * 5 + seed + extra;
  const scene = SCENES[n % SCENES.length];
  return (
    <figure className={`poster scene-${scene}`}>
      <button type="button" className="poster-tap" onClick={() => setExtra((x) => x + 1)} aria-label="Ver otra frase" />
      <div className="poster-art" aria-hidden>
        <i className="p-stars" />
        <i className="p-sun" />
        <i className="p-l1" />
        <i className="p-l2" />
        <i className="p-l3" />
        <i className="p-detail" />
      </div>
      <blockquote key={n}>{PHRASES[n % PHRASES.length]}</blockquote>
      <figcaption>BUT Calls</figcaption>
    </figure>
  );
}
