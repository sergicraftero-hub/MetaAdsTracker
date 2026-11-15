/** Punto único de acceso a los datos: Notion, o datos de demostración si no hay token. */
import { demo, demoSchema } from "./demo";
import * as notion from "./notion";
import type { CallLog, Fields, Lead, Schema, StoredUser } from "./types";

export const isDemo = () => !process.env.NOTION_TOKEN;

export const store = {
  getSchema: async (force = false): Promise<Schema> => (isDemo() ? demoSchema : notion.getSchema(force)),
  getLeads: async (): Promise<{ leads: Lead[]; syncedAt: number }> => (isDemo() ? demo.getLeads() : notion.getLeads()),
  getLead: async (id: string): Promise<Lead | undefined> => (isDemo() ? demo.getLead(id) : notion.getLead(id)),
  /** Lee el lead sin caché, para comprobar que nadie lo ha cogido mientras tanto. */
  refreshLead: async (id: string): Promise<Lead | undefined> => (isDemo() ? demo.getLead(id) : notion.refreshLead(id)),
  updateLead: async (id: string, f: Partial<Fields>): Promise<Lead> =>
    isDemo() ? demo.updateLead(id, f) : notion.updateLead(id, f),
  createLead: async (f: Partial<Fields>): Promise<Lead> => (isDemo() ? demo.createLead(f) : notion.createLead(f)),
  attachContract: async (id: string, file: File): Promise<Lead> =>
    isDemo() ? demo.attachContract(id, file.name) : notion.attachContract(id, file),

  usersConfigured: async (): Promise<boolean> => isDemo() || notion.usersConfigured(),
  listUsers: async (force = false): Promise<StoredUser[]> => (isDemo() ? demo.listUsers() : notion.listUsers(force)),
  saveUser: async (id: string | null, u: Partial<StoredUser>): Promise<StoredUser> =>
    isDemo() ? demo.saveUser(id, u) : notion.saveUser(id, u),

  logConfigured: async (): Promise<boolean> => isDemo() || notion.logConfigured(),
  addLog: async (e: Omit<CallLog, "id">): Promise<CallLog | null> => (isDemo() ? demo.addLog(e) : notion.addLog(e)),
  getLog: async (from: number): Promise<CallLog[]> => (isDemo() ? demo.getLog(from) : notion.getLog(from)),
};

export const unassignedVisible = () => process.env.COMERCIAL_VE_SIN_ASIGNAR !== "false";
