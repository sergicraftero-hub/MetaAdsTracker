export const FIELD_KEYS = [
  "nombre",
  "telefono",
  "email",
  "cp",
  "fecha",
  "estado",
  "comercial",
  "fechaContacto",
  "intento1",
  "intento2",
  "intento3",
  "intentos",
  "rellamada",
  "whatsapp",
  "comentarios",
  "compania",
  "cuantoPaga",
  "titular",
  "quiereTele",
  "estadoContrato",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];
export type Value = string | number | boolean | null;
export type Fields = Record<FieldKey, Value>;

export interface Lead {
  id: string;
  url?: string;
  edited: string;
  f: Fields;
}

export interface Option {
  name: string;
  color: string;
}

export interface FieldSchema {
  key: FieldKey;
  /** Nombre real de la columna en Notion */
  name: string;
  /** Tipo de propiedad de Notion (rich_text, select, date…) o "missing" */
  type: string;
  options?: Option[];
  writable: boolean;
}

export type Schema = Record<FieldKey, FieldSchema>;

export type Role = "admin" | "comercial";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Valor de la columna COMERCIAL que identifica a este usuario */
  code: string;
  active: boolean;
}

export interface StoredUser extends User {
  hash: string;
}

export interface Session {
  uid: string;
  name: string;
  email: string;
  role: Role;
  code: string;
  exp: number;
}

export interface LeadsPayload {
  leads: Lead[];
  schema: Schema;
  me: Session;
  comerciales: string[];
  demo: boolean;
  syncedAt: string;
}
