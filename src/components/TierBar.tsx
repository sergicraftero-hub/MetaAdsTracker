/**
 * Barra de progreso por tramos: una marca en cada escalón y el relleno hasta donde se ha llegado.
 * Solo muestra números de fibras, nunca importes, así que sirve también para el comercial.
 */
export default function TierBar({ value, steps, label }: { value: number; steps: number[]; label?: string }) {
  const marks = [...new Set(steps)].filter((s) => s > 0).sort((a, b) => a - b);
  if (!marks.length) return null;
  const max = Math.max(marks[marks.length - 1], value);
  const next = marks.find((s) => value < s);
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
  const text = `${label ?? "Progreso"}: ${value} de ${next ?? marks[marks.length - 1]} fibras${next ? "" : ", tramo más alto alcanzado"}`;
  return (
    <div className="tierbar" role="img" aria-label={text}>
      <div className="tb-track">
        <span className="tb-fill" style={{ width: pct(value) }} />
        {marks.map((s) => (
          <i key={s} className={value >= s ? "tb-tick on" : s === next ? "tb-tick next" : "tb-tick"} style={{ left: pct(s) }} />
        ))}
      </div>
      <div className="tb-labels" aria-hidden>
        {marks.map((s) => (
          <span key={s} className={value >= s ? "on" : s === next ? "next" : undefined} style={{ left: pct(s) }}>{s}</span>
        ))}
      </div>
    </div>
  );
}
