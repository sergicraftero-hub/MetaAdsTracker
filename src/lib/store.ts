/** Punto único de acceso a los datos: Notion, o datos de demostración si no hay token. */
import { demo, demoSchema } from "./demo";
import * as notion from "./notion";
import type { Fields, Lead, Schema, StoredUser } from "./types";

export const isDemo = () => !process.env.NOTION_TOKEN;

export const store = {
  getSchema: async (force = false): Promise<Schema> => (isDemo() ? demoSchema : notion.getSchema(force)),
  getLeads: async (): Promise<{ leads: Lead[]; syncedAt: number }> => (isDemo() ? demo.getLeads() : notion.getLeads()),
  getLead: async (id: string): Promise<Lead | undefined> => (isDemo() ? demo.getLead(id) : notion.getLead(id)),
  updateLead: async (id: string, f: Partial<Fields>): Promise<Lead> =>
    isDemo() ? demo.updateLead(id, f) : notion.updateLead(id, f),
  createLead: async (f: Partial<Fields>): Promise<Lead> => (isDemo() ? demo.createLead(f) : notion.createLead(f)),
  usersConfigured: (): boolean => isDemo() || notion.usersConfigured(),
  listUsers: async (force = false): Promise<StoredUser[]> => (isDemo() ? demo.listUsers() : notion.listUsers(force)),
  saveUser: async (id: string | null, u: Partial<StoredUser>): Promise<StoredUser> =>
    isDemo() ? demo.saveUser(id, u) : notion.saveUser(id, u),
};

export const unassignedVisible = () => process.env.COMERCIAL_VE_SIN_ASIGNAR !== "false";
