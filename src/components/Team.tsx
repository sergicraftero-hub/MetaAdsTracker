"use client";
import { useCallback, useEffect, useState } from "react";
import type { LeadsPayload, User } from "@/lib/types";
import { api } from "./util";

interface Status {
  demo: boolean;
  fields: { name: string; type: string; writable: boolean }[];
}

export default function Team({ data, toast }: { data: LeadsPayload; toast: (m: string, e?: boolean) => void }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "comercial", code: "", password: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ configured: boolean; users: User[] }>("/api/users");
      setUsers(r.users);
      setConfigured(r.configured);
    } catch (e) {
      toast((e as Error).message, true);
      setUsers([]);
    }
  }, [toast]);

  useEffect(() => {
    load();
    api<Status>("/api/status").then(setStatus).catch(() => {});
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/users", "POST", form);
      setForm({ name: "", email: "", role: "comercial", code: "", password: "" });
      toast("Usuario creado");
      await load();
    } catch (err) {
      toast((err as Error).message, true);
    }
    setBusy(false);
  }

  async function patch(id: string, body: Record<string, unknown>, ok: string) {
    try {
      await api(`/api/users/${id}`, "PATCH", body);
      toast(ok);
      await load();
    } catch (err) {
      toast((err as Error).message, true);
    }
  }

  const missing = status?.fields.filter((f) => f.type === "missing") ?? [];

  return (
    <div className="stack">
      <section className="card">
        <h2>Usuarios</h2>
        {!configured ? (
          <p className="notice">
            Aún no hay base de datos de usuarios, así que solo puede entrar el administrador inicial. Para dar acceso a los
            comerciales: crea en Notion una página llamada «BUT Calls» y compártela con la integración (··· → Conexiones). La
            app crea dentro las bases de usuarios y de registro de llamadas; vuelve a esta pantalla un minuto después.
          </p>
        ) : users === null ? (
          <p className="muted">Cargando…</p>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Código</th>
                    <th>Acceso</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <th scope="row">{u.name}</th>
                      <td>{u.email}</td>
                      <td>{u.role === "admin" ? "Dirección" : "Comercial"}</td>
                      <td>{u.code || "—"}</td>
                      <td>{u.active ? "Activo" : "Desactivado"}</td>
                      <td className="cell-actions">
                        <button className="btn small" onClick={() => patch(u.id, { active: !u.active }, u.active ? "Acceso desactivado" : "Acceso activado")}>
                          {u.active ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          className="btn small"
                          onClick={() => {
                            const password = window.prompt(`Nueva contraseña para ${u.name} (mínimo 8 caracteres)`);
                            if (password) patch(u.id, { password }, "Contraseña cambiada");
                          }}
                        >
                          Contraseña
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted">Todavía no hay usuarios.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <form className="newuser" onSubmit={create}>
              <h3>Añadir usuario</h3>
              <div className="grid2">
                <label>
                  Nombre
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </label>
                <label>
                  Email
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </label>
                <label>
                  Rol
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="comercial">Comercial (ve solo sus leads)</option>
                    <option value="admin">Dirección (ve todo)</option>
                  </select>
                </label>
                <label>
                  Código en la columna COMERCIAL
                  <input list="codes" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="p. ej. AYA" />
                  <datalist id="codes">{data.comerciales.map((c) => <option key={c} value={c} />)}</datalist>
                </label>
                <label>
                  Contraseña inicial
                  <input required minLength={8} type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </label>
              </div>
              <button className="btn primary" disabled={busy}>{busy ? "Creando…" : "Crear usuario"}</button>
            </form>
          </>
        )}
      </section>

      <section className="card">
        <h2>Conexión con Notion</h2>
        {!status ? (
          <p className="muted">Comprobando…</p>
        ) : (
          <>
            <p className={missing.length ? "error" : "muted"}>
              {status.demo
                ? "Modo demostración: no hay token de Notion configurado y los datos son inventados."
                : missing.length
                  ? `Faltan ${missing.length} columnas en la base de Notion: ${missing.map((m) => m.name).join(", ")}.`
                  : `Conectado. Las ${status.fields.length} columnas que usa la app existen en Notion.`}
            </p>
            <details>
              <summary>Ver columnas</summary>
              <ul className="cols">
                {status.fields.map((f) => (
                  <li key={f.name}>
                    <code>{f.name}</code> <span className="muted">{f.type === "missing" ? "no encontrada" : f.type}</span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </section>
    </div>
  );
}
