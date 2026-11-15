/** Pantalla vacía con la marca: el «BUT» del logo, un título y una línea de ayuda. */
export default function Empty({ title, text, small }: { title: string; text?: string; small?: boolean }) {
  return (
    <div className={small ? "empty small" : "empty"}>
      <span className="empty-mark" aria-hidden>BUT</span>
      <strong>{title}</strong>
      {text && <span className="muted">{text}</span>}
    </div>
  );
}
