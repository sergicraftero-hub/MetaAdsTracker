"use client";
import { useState } from "react";

export default function LoginForm({ demo }: { demo: boolean }) {
  const [email, setEmail] = useState(demo ? "demo@demo.com" : "");
  const [password, setPassword] = useState(demo ? "demo" : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      setError((await res.json().catch(() => ({}))).error ?? "No se pudo entrar");
    } catch {
      setError("Sin conexión. Inténtalo de nuevo.");
    }
    setBusy(false);
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-brand">
          <img src="/logo.svg" alt="BUT Calls" width={150} />
        </div>
        <p className="muted">Seguimiento comercial de leads</p>
        {demo && (
          <p className="notice">
            Modo demostración con datos inventados. Entra como dirección (demo@demo.com) o como comercial (ana@demo.com); la
            contraseña es «demo».
          </p>
        )}
        <label>
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Contraseña
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}
