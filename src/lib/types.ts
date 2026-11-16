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
  /** Horas de jornada al día que fija dirección (0 = sin límite) */
  hours?: number;
  /** Dirección le deja ver la pestaña Embudo (los de dirección la ven siempre) */
  embudo?: boolean;
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

export type SaleOrigin = "Movistar" | "No Movistar";

/** Producto del catálogo de O2. La comisión solo se envía a dirección. */
export interface Product {
  id: string;
  family: string;
  name: string;
  price: number;
  /** Cuenta como alta de fibra para las extracomisiones (convergente o solo fibra, no la fibra adicional) */
  baf: boolean;
  commission?: number;
}

/** Contratación: una fila de «Seguimiento O2». */
export interface Sale {
  id: string;
  name: string;
  dni: string;
  phone: string;
  /** Día de la firma, YYYY-MM-DD */
  date: string;
  installFiber: string;
  installPort: string;
  /** Estado del seguimiento en Notion (Pdt cita, Pdt instalación, Listo…) */
  state: string;
  /** Código para el comercial: «Código 1», «Código 2»… */
  code: string;
  /** Nombre real del código de carga. Solo para dirección */
  realCode?: string;
  products: string[];
  origin: SaleOrigin;
  /** La fibra es de primera residencia (solo esas cuentan para las extracomisiones) */
  primary: boolean;
  comercial: string;
  leadId: string;
  baja: boolean;
  comments: string;
  /** Nombre del contrato adjunto, si lo hay */
  contract: string;
  /** Solo para dirección */
  paid?: boolean;
  commission?: number;
  baf?: boolean;
  /** La venta incluye fibra principal */
  fiber?: boolean;
}

/** Lo que la app lee de un contrato de O2 en PDF. */
export interface ContractData {
  pdv: string;
  date: string;
  name: string;
  dni: string;
  phone: string;
  email: string;
  address: string;
  productText: string;
  price: number;
  origin: SaleOrigin;
  /** Productos del catálogo reconocidos */
  products: string[];
  /** Código (alias) que corresponde al punto de venta del contrato, si se reconoce */
  code: string;
}

/** Mensaje de WhatsApp preparado por cada usuario. Admite {nombre} (del cliente) y {yo} (de quien escribe). */
export interface Template {
  title: string;
  text: string;
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
  /** Petición de corrección abierta por el trabajador (vacío si no hay) */
  ticket: string;
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
  /** Segundos que el móvil estuvo fuera de la app tras pulsar Llamar: duración real aproximada de la llamada (0 = sin medir) */
  away: number;
  /** Teléfono al que se llamó */
  phone: string;
}

export interface LeadsPayload {
  leads: Lead[];
  schema: Schema;
  me: Session;
  comerciales: string[];
  demo: boolean;
  syncedAt: string;
  /** Códigos de los comerciales que han fichado y están trabajando (null si no hay fichaje configurado) */
  working: string[] | null;
  /** ¿Ha fichado la entrada quien pregunta? (null si no hay fichaje configurado) */
  clockedIn: boolean | null;
  /** Jornada abierta de quien pregunta y sus horas diarias, para avisarle cuando se acaba */
  clock: { start: string; breaks: { s: string; e: string | null }[]; hours: number } | null;
  /** ¿Está conectado el WhatsApp compartido? */
  waReady: boolean;
  /** Si este usuario puede ver la pestaña Embudo */
  embudo: boolean;
  /** ¿Existe la base de datos donde se registran las llamadas? */
  logReady: boolean;
}
