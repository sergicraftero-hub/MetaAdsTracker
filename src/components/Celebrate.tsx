"use client";
import { useEffect, useState } from "react";

const EVENT = "but-firmado";
const COLORS = ["#1c3d5a", "#f5f3ee", "#c8a45a", "#2a78d6", "#c8a45a", "#f5f3ee"];
const PIECES = Array.from({ length: 44 }, (_, i) => {
  // Reparto fijo (sin azar) para que la animación sea siempre igual de limpia
  const angle = (i / 44) * Math.PI * 2 + (i % 3) * 0.21;
  const reach = 24 + ((i * 37) % 30);
  return {
    dx: Math.cos(angle) * reach,
    dy: Math.sin(angle) * reach * 0.8 - 12,
    rot: (i * 97) % 720,
    delay: (i % 7) * 0.03,
    color: COLORS[i % COLORS.length],
    shape: i % 4,
  };
});

/** Lanza la celebración de una venta firmada desde cualquier pantalla. */
export const celebrate = (name: string) => window.dispatchEvent(new CustomEvent(EVENT, { detail: name }));

/** Celebración breve al firmar: no bloquea la pantalla y se va sola. */
export default function Celebration() {
  const [party, setParty] = useState<{ name: string; n: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      clearTimeout(timer);
      setParty((p) => ({ name: String((e as CustomEvent).detail ?? ""), n: (p?.n ?? 0) + 1 }));
      timer = setTimeout(() => setParty(null), 2800);
    };
    window.addEventListener(EVENT, on);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(EVENT, on);
    };
  }, []);
  if (!party) return null;
  return (
    <div className="party" key={party.n} role="status">
      <div className="party-burst" aria-hidden>
        {PIECES.map((p, i) => (
          <i
            key={i}
            className={`cf cf-${p.shape}`}
            style={{ "--dx": `${p.dx}vmin`, "--dy": `${p.dy}vmin`, "--rot": `${p.rot}deg`, "--delay": `${p.delay}s`, background: p.color } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="party-card">
        <svg className="party-check" viewBox="0 0 64 64" width="72" height="72" aria-hidden>
          <circle cx="32" cy="32" r="28" />
          <path d="M20 33l8.5 8.5L45 24" />
        </svg>
        <strong className="party-title">¡Firmado!</strong>
        {party.name && <span className="party-name">{party.name}</span>}
      </div>
    </div>
  );
}
