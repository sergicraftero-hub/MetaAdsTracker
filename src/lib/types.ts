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

/** Comentario de la página del lead en Notion (donde el equipo deja las notas y el contrato). */
export interface Comment {
  id: string;
  at: string;
  author: string;
  text: string;
  files: { name: string; url: string }[];
}

/** Jornada fichada por un trabajador. */
export interface Shift {
  id: string;
  user: string;
  name: string;
  start: string;
  end: string | null;
  breaks: { s: string; e: string | null }[];
  /** Historial de correcciones hechas por dirección */
  edits: string;
  /** false si el registro se ha modificado fuera de la app */
  valid: boolean;
}

export type LeaveStatus = "pendiente" | "aprobada" | "rechazada";

/** Solicitud de un trabajador (vacaciones, asuntos propios…) que dirección aprueba o rechaza. */
export interface Leave {
  id: string;
  user: string;
  name: string;
  type: string;
  from: string;
  to: string;
  status: LeaveStatus;
  note: string;
  resolved: string;
  created: string;
}

export interface Payslip {
  id: string;
  user: string;
  name: string;
  period: string;
  file: string;
}

export interface Person {
  email: string;
  name: string;
}

/** Conversación del WhatsApp compartido. */
export interface WaChat {
  id: string;
  phone: string;
  name: string;
  at: string;
  unread: number;
  last: string;
  lastFromMe: boolean;
  /** Etiquetas de WhatsApp Business del chat (el comercial asignado es una de ellas) */
  labels: string[];
}

export interface WaMessage {
  id: string;
  chatId: string;
  fromMe: boolean;
  at: string;
  text: string;
  status?: string;
  file?: { id: string; name: string; mime: string; kind: string };
  /** Quién del equipo lo envió desde la app (si se sabe) */
  by?: string;
}

export type BonusMetric = "firmados" | "llamadas" | "contactos";
export type BonusPeriod = "dia" | "semana" | "mes";

/** Bono o premio que fija dirección: para todo el equipo (para = "") o para una persona. */
export interface Bonus {
  id: string;
  title: string;
  prize: string;
  metric: BonusMetric;
  goal: number;
  period: BonusPeriod;
  /** Código o nombre del comercial; vacío si es de todo el equipo */
  para: string;
  active: boolean;
  /** Lo conseguido en el periodo actual (lo calcula el servidor) */
  value?: number;
}

/** Aviso para llamar desde el móvil a un lead abierto en el ordenador. */
export interface CallAlert {
  id: string;
  leadId: string;
  name: string;
  phone: string;
}

/** Una llamada (o un lead saltado) del modo «Llamar». */
export interface CallLog {
  id: string;
  /** Momento en que el lead apareció en pantalla */
  at: string;
  user: string;
  code: string;
  leadId: string;
  leadName: string;
  /** nuevo | antiguo | rellamada | ilocalizable */
  source: string;
  /** Estado elegido, o SALTADO */
  result: string;
  /** Segundos entre que apareció el lead y se guardó el resultado */
  seconds: number;
  /** Si se pulsó el botón de llamar */
  called: boolean;
}

export interface LeadsPayload {
  leads: Lead[];
  schema: Schema;
  me: Session;
  comerciales: string[];
  demo: boolean;
  syncedAt: string;
  /** ¿Está conectado el WhatsApp compartido? */
  waReady: boolean;
  /** ¿Existe la base de datos donde se registran las llamadas? */
  logReady: boolean;
}
