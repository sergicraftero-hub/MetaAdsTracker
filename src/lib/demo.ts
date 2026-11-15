/**
 * Modo demostración: datos inventados en memoria.
 * Se activa cuando no hay NOTION_TOKEN, para probar la app sin tocar Notion.
 */
import { NOTION_NAMES } from "./fields";
import { hashPassword } from "./password";
import { FIELD_KEYS } from "./types";
import type { Fields, Lead, Option, Schema, StoredUser } from "./types";

const ESTADOS: Option[] = [
  { name: "RELLAMAR", color: "orange" },
  { name: "ILOCALIZABLE", color: "purple" },
  { name: "CONTACTADO E INTERESADO", color: "green" },
  { name: "HABLANDO POR WHATSAPP", color: "yellow" },
  { name: "LO ESTÁ PENSANDO AÚN", color: "yellow" },
  { name: "SCORING", color: "gray" },
  { name: "FIMADO", color: "blue" },
  { name: "CONTACTADO Y NO INTERESADO", color: "red" },
  { name: "AL FINAL NO", color: "red" },
  { name: "SIN COBERTURA", color: "brown" },
  { name: "CLIENTE EXISTENTE O2", color: "pink" },
  { name: "NUMERO ERRONEO", color: "pink" },
];
const COMERCIALES: Option[] = [
  { name: "ANA", color: "pink" },
  { name: "LUIS", color: "brown" },
];

const TYPES: Partial<Record<string, string>> = {
  nombre: "title",
  estado: "select",
  comercial: "select",
  estadoContrato: "select",
  fechaContacto: "date",
  rellamada: "date",
  whatsapp: "checkbox",
  intentos: "number",
};

export const demoSchema: Schema = Object.fromEntries(
  FIELD_KEYS.map((key) => {
    const type = TYPES[key] ?? "rich_text";
    const options =
      key === "estado"
        ? ESTADOS
        : key === "comercial"
          ? COMERCIALES
          : key === "estadoContrato"
            ? [
                { name: "SCORING", color: "orange" },
                { name: "FIRMADO", color: "green" },
                { name: "INSTALADO", color: "purple" },
                { name: "BAJA", color: "red" },
              ]
            : undefined;
    return [key, { key, name: NOTION_NAMES[key], type, options, writable: true }];
  }),
) as Schema;

function seed(): Lead[] {
  let s = 42;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const nombres = ["Lucía", "Marcos", "Elena", "Jorge", "Nuria", "Pablo", "Irene", "Sergio", "Marta", "Óscar", "Clara", "Iván"];
  const apellidos = ["Demo Uno", "Prueba Dos", "Ejemplo Tres", "Ficticio Cuatro", "Muestra Cinco", "Ensayo Seis"];
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = Date.now();
  const leads: Lead[] = [];
  for (let i = 0; i < 64; i++) {
    const created = new Date(now - i * 5.3 * 3600_000 - rnd() * 3600_000);
    const fresh = i < 9 || rnd() < 0.12;
    const estado = fresh ? null : pick(ESTADOS).name;
    const f = Object.fromEntries(FIELD_KEYS.map((k) => [k, null])) as Fields;
    f.nombre = `${pick(nombres)} ${pick(apellidos)}`;
    f.telefono = `+346000${pad(i)}${pad(Math.floor(rnd() * 99))}`;
    f.email = `lead${i + 1}@example.com`;
    f.cp = pick(["28013", "08024", "46600", "41003", "33010"]);
    f.fecha = created.toISOString();
    f.estado = estado;
    f.whatsapp = rnd() < 0.2;
    f.compania = pick(["movistar", "movistar", "orange", "vodafone", "otro"]);
    f.cuantoPaga = pick(["más_de_70_€", "50–70_€", "35–50_€", "menos_de_35_€"]);
    f.titular = pick(["sí", "sí", "no,_pero_puedo_decidir"]);
    f.quiereTele = pick(["movistar_plus+_y_netflix", "solo_movistar_plus+", "no_quiero_tele"]);
    if (estado) {
      f.fechaContacto = day(new Date(created.getTime() + 3600_000));
      f.intento1 = `${pad(10 + Math.floor(rnd() * 9))}:${pad(Math.floor(rnd() * 60))}`;
      f.intentos = 1;
      f.comercial = pick(COMERCIALES).name;
      if (estado === "RELLAMAR" || estado === "CONTACTADO E INTERESADO") {
        const when = new Date(now + (Math.floor(rnd() * 5) - 1) * 86400_000);
        when.setHours(9 + Math.floor(rnd() * 9), pick([0, 30]), 0, 0);
        f.rellamada = rnd() < 0.5 ? day(when) : when.toISOString();
      }
    }
    leads.push({ id: `demo-${i + 1}`, edited: created.toISOString(), f });
  }
  return leads;
}

interface DemoState {
  leads: Map<string, Lead>;
  users: StoredUser[];
  n: number;
}
const g = globalThis as unknown as { __crmDemo?: DemoState };

function state(): DemoState {
  return (g.__crmDemo ??= {
    leads: new Map(seed().map((l) => [l.id, l])),
    users: [
      { id: "u-ana", name: "Ana (comercial demo)", email: "ana@demo.com", role: "comercial", code: "ANA", active: true, hash: hashPassword("demo") },
      { id: "u-luis", name: "Luis (comercial demo)", email: "luis@demo.com", role: "comercial", code: "LUIS", active: true, hash: hashPassword("demo") },
    ],
    n: 100,
  });
}

export const demo = {
  getLeads: () => ({ leads: [...state().leads.values()], syncedAt: Date.now() }),
  getLead: (id: string) => state().leads.get(id),
  updateLead(id: string, fields: Partial<Fields>): Lead {
    const cur = state().leads.get(id);
    if (!cur) throw new Error("Lead no encontrado");
    const next = { ...cur, edited: new Date().toISOString(), f: { ...cur.f, ...fields } };
    state().leads.set(id, next);
    return next;
  },
  createLead(fields: Partial<Fields>): Lead {
    const st = state();
    const f = { ...(Object.fromEntries(FIELD_KEYS.map((k) => [k, null])) as Fields), whatsapp: false, ...fields };
    const lead = { id: `demo-${++st.n}`, edited: new Date().toISOString(), f };
    st.leads.set(lead.id, lead);
    return lead;
  },
  listUsers: () => state().users,
  saveUser(id: string | null, u: Partial<StoredUser>): StoredUser {
    const st = state();
    if (id) {
      const i = st.users.findIndex((x) => x.id === id);
      if (i < 0) throw new Error("Usuario no encontrado");
      return (st.users[i] = { ...st.users[i], ...u });
    }
    const user: StoredUser = { id: `u-${++st.n}`, name: "", email: "", role: "comercial", code: "", active: true, hash: "", ...u };
    st.users.push(user);
    return user;
  },
};
