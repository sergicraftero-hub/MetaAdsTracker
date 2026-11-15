import type { FieldKey, Lead, Session } from "./types";

/** Columna de Notion que corresponde a cada campo de la app. */
export const NOTION_NAMES: Record<FieldKey, string> = {
  nombre: "NOMBRE",
  telefono: "TELEFONO",
  email: "Email",
  cp: "CIUDAD",
  fecha: "Fecha",
  estado: "ESTADO",
  comercial: "COMERCIAL",
  fechaContacto: "FECHA_CONTACTO",
  intento1: "1ER_INTENTO",
  intento2: "2DO_INTENTO",
  intento3: "3ER_INTENTO",
  intentos: "INTENTOS",
  rellamada: "RELLAMADA",
  whatsapp: "WHATSAPP",
  comentarios: "Comentarios",
  compania: "Compañia",
  cuantoPaga: "Cuanto paga",
  titular: "Titular",
  quiereTele: "Kiere tele",
  estadoContrato: "ESTADO_CONTRATO",
};

export const LABELS: Record<FieldKey, string> = {
  nombre: "Nombre",
  telefono: "Teléfono",
  email: "Email",
  cp: "Código postal",
  fecha: "Entrada",
  estado: "Estado",
  comercial: "Comercial",
  fechaContacto: "Primer contacto",
  intento1: "1.er intento",
  intento2: "2.º intento",
  intento3: "3.er intento",
  intentos: "Intentos",
  rellamada: "Rellamada",
  whatsapp: "WhatsApp enviado",
  comentarios: "Comentarios",
  compania: "Compañía actual",
  cuantoPaga: "Paga al mes",
  titular: "Titular",
  quiereTele: "Tele",
  estadoContrato: "Estado del contrato",
};

/** Intentos de llamada sin localizar al lead tras los que se da por perdido */
export const MAX_ATTEMPTS = 5;
/** Estado que recibe un lead al agotar los intentos */
export const LOST_STATE = "PERDIDO";

export type Stage = "nuevo" | "abierto" | "ganado" | "perdido";

const WON = /^FI?R?MADO$/i;
const LOST = new Set(
  [
    "PERDIDO",
    "AL FINAL NO",
    "CONTACTADO Y NO INTERESADO",
    "CONTRATO CON OTRA COMPAÑIA",
    "NUMERO ERRONEO",
    "CLIENTE EXISTENTE O2",
    "REPETIDO",
    "QUIERE MOVIL FINAN",
    "SIN COBERTURA",
    "CONTRATO O2 POR OTRO CANAL",
  ].map((s) => s.toUpperCase()),
);

/** Fase del embudo a la que pertenece un valor de ESTADO. */
export function stageOf(estado: unknown): Stage {
  const s = typeof estado === "string" ? estado.trim() : "";
  if (!s) return "nuevo";
  if (WON.test(s)) return "ganado";
  if (LOST.has(s.toUpperCase())) return "perdido";
  return "abierto";
}

export function isClosed(estado: unknown): boolean {
  const st = stageOf(estado);
  return st === "ganado" || st === "perdido";
}

/** ¿Puede este usuario ver este lead? */
/**
 * `working` son los códigos de los comerciales que han fichado hoy (null si no hay fichaje configurado).
 */
export function canSee(me: Session, lead: Lead, unassignedVisible: boolean, working: string[] | null = null): boolean {
  if (me.role === "admin") return true;
  const owner = typeof lead.f.comercial === "string" ? lead.f.comercial.trim() : "";
  // Agenda compartida: una rellamada pendiente la puede atender quien esté de turno
  if (lead.f.rellamada && !isClosed(lead.f.estado)) return true;
  if (!owner) return unassignedVisible;
  // Lo que aún no se ha conseguido contactar de un comercial que hoy no ha fichado pasa al resto del equipo
  if (working && !working.some((c) => c.trim().toLowerCase() === owner.toLowerCase())) {
    const st = stageOf(lead.f.estado);
    if (st === "nuevo" || String(lead.f.estado).toUpperCase() === "ILOCALIZABLE") return true;
  }
  return !!me.code && owner.toLowerCase() === me.code.trim().toLowerCase();
}
