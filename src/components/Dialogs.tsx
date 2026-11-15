"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/** Diálogos propios de la app (confirmar y pedir datos), en lugar de las ventanas del navegador. */

export interface Field {
  key: string;
  label: string;
  type?: "text" | "number" | "password" | "select" | "textarea";
  value?: string;
  options?: { value: string; label: string }[];
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  required?: boolean;
  placeholder?: string;
}
interface ConfirmOpts {
  title: string;
  text?: string;
  ok?: string;
  danger?: boolean;
}
interface FormOpts extends ConfirmOpts {
  fields: Field[];
}
type Values = Record<string, string>;

interface Api {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  form: (o: FormOpts) => Promise<Values | null>;
}

const Ctx = createContext<Api | null>(null);

export function useDialogs(): Api {
  const api = useContext(Ctx);
  if (!api) throw new Error("Falta DialogProvider");
  return api;
}

interface Open extends ConfirmOpts {
  fields?: Field[];
  resolve: (v: Values | null) => void;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [values, setValues] = useState<Values>({});
  const first = useRef<HTMLButtonElement>(null);

  const show = useCallback(
    (o: ConfirmOpts & { fields?: Field[] }) =>
      new Promise<Values | null>((resolve) => {
        setValues(Object.fromEntries((o.fields ?? []).map((f) => [f.key, f.value ?? ""])));
        setOpen({ ...o, resolve });
      }),
    [],
  );
  const api = useRef<Api>({
    confirm: async (o) => (await show(o)) !== null,
    form: (o) => show(o),
  }).current;

  const close = useCallback(
    (v: Values | null) => {
      open?.resolve(v);
      setOpen(null);
    },
    [open],
  );

  useEffect(() => {
    if (!open) return;
    if (!open.fields?.length) first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {open && (
        <div className="overlay centered dialog-layer" onClick={(e) => e.target === e.currentTarget && close(null)}>
          <form
            className="card modal dialog"
            role="dialog"
            aria-modal="true"
            aria-label={open.title}
            onSubmit={(e) => {
              e.preventDefault();
              close(values);
            }}
          >
            <h2>{open.title}</h2>
            {open.text && <p className="muted">{open.text}</p>}
            {open.fields?.map((f, i) => (
              <label key={f.key}>
                {f.label}
                {f.type === "select" ? (
                  <select value={values[f.key] ?? ""} autoFocus={i === 0} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea rows={4} value={values[f.key] ?? ""} autoFocus={i === 0} required={f.required} maxLength={f.max} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                ) : (
                  <input
                    type={f.type === "password" ? "text" : (f.type ?? "text")}
                    value={values[f.key] ?? ""}
                    autoFocus={i === 0}
                    required={f.required}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    minLength={f.minLength}
                    placeholder={f.placeholder}
                    autoComplete="off"
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  />
                )}
                {f.hint && <span className="muted hint">{f.hint}</span>}
              </label>
            ))}
            <div className="contact">
              <button type="button" className="btn" onClick={() => close(null)}>Cancelar</button>
              <button ref={first} className={open.danger ? "btn danger-solid" : "btn primary"}>{open.ok ?? "Aceptar"}</button>
            </div>
          </form>
        </div>
      )}
    </Ctx.Provider>
  );
}
