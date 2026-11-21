/** Punto único de acceso a los datos: Notion, o datos de demostración si no hay token. */
import { demo, demoSchema } from "./demo";
import * as notion from "./notion";
import type { Bonus, CallAlert, CallLog, Comment, Fields, Lead, Schema, StoredUser, WaChat, WaMessage } from "./types";
import * as whapi from "./whapi";

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
  listComments: async (id: string): Promise<Comment[]> => (isDemo() ? demo.listComments(id) : notion.listComments(id)),
  addComment: async (id: string, text: string, file?: File): Promise<void> =>
    isDemo() ? demo.addComment(id, text, file) : notion.addComment(id, text, file),

  usersConfigured: async (): Promise<boolean> => isDemo() || notion.usersConfigured(),
  listUsers: async (force = false): Promise<StoredUser[]> => (isDemo() ? demo.listUsers() : notion.listUsers(force)),
  saveUser: async (id: string | null, u: Partial<StoredUser>): Promise<StoredUser> =>
    isDemo() ? demo.saveUser(id, u) : notion.saveUser(id, u),

  addAlert: async (to: string, a: Omit<CallAlert, "id">): Promise<boolean> => (isDemo() ? demo.addAlert(to, a) : notion.addAlert(to, a)),
  listAlerts: async (to: string): Promise<CallAlert[]> => (isDemo() ? demo.listAlerts(to) : notion.listAlerts(to)),
  setAlertAway: async (to: string, id: string, seconds: number): Promise<void> =>
    isDemo() ? demo.setAlertAway(to, id, seconds) : notion.setAlertAway(to, id, seconds),
  takeAlertAway: async (to: string, leadId: string): Promise<number> => (isDemo() ? demo.takeAlertAway(to, leadId) : notion.takeAlertAway(to, leadId)),
  removeAlert: async (id: string): Promise<void> => (isDemo() ? demo.removeAlert(id) : notion.removeAlert(id)),

  bonusConfigured: async (): Promise<boolean> => isDemo() || notion.bonusConfigured(),
  listBonuses: async (): Promise<Bonus[]> => (isDemo() ? demo.listBonuses() : notion.listBonuses()),
  saveBonus: async (id: string | null, b: Partial<Bonus>): Promise<Bonus> => (isDemo() ? demo.saveBonus(id, b) : notion.saveBonus(id, b)),
  deleteBonus: async (id: string): Promise<void> => (isDemo() ? demo.deleteBonus(id) : notion.deleteBonus(id)),

  /* WhatsApp compartido */
  waConfigured: (): boolean => isDemo() || whapi.waConfigured(),
  waHealth: async () => (isDemo() ? { ok: true, status: "AUTH", phone: "34600000000" } : whapi.waHealth()),
  waChats: async (): Promise<WaChat[]> => (isDemo() ? demo.waChats() : whapi.waChats()),
  waMessages: async (chatId: string): Promise<WaMessage[]> => {
    if (isDemo()) return demo.waMessages(chatId);
    const [messages, authors] = await Promise.all([whapi.waMessages(chatId), notion.waAuthors(chatId).catch(() => ({}) as Record<string, string>)]);
    return messages.map((m) => (authors[m.id] ? { ...m, by: authors[m.id] } : m));
  },
  waSend: async (chatId: string, text: string, file: File | undefined, by: string): Promise<WaMessage> => {
    if (isDemo()) return demo.waSend(chatId, text, file, by);
    const m = await whapi.waSend(chatId, text, file);
    await notion.addWaAuthor(m.id, chatId, by).catch((e) => console.error("No se pudo anotar el autor del WhatsApp", e));
    return { ...m, by };
  },
  waAssign: async (chatId: string, owner: string, comerciales: string[]): Promise<string[]> =>
    isDemo() ? demo.waAssign(chatId, owner, comerciales) : whapi.waAssign(chatId, owner, comerciales),
  waSetUnread: async (chatId: string, unread: boolean): Promise<void> =>
    isDemo() ? demo.waSetUnread(chatId, unread) : whapi.waSetUnread(chatId, unread),
  waMarkRead: async (messageId: string): Promise<void> => {
    if (!isDemo()) await whapi.waMarkRead(messageId);
  },

  /* Reserva de un lead mientras alguien lo está llamando */
  lockLead: async (leadId: string, name: string, user: string): Promise<boolean> =>
    isDemo() ? demo.lockLead(leadId, user) : notion.lockLead(leadId, name, user),
  unlockLead: async (leadId: string, user: string): Promise<void> => (isDemo() ? demo.unlockLead(leadId, user) : notion.unlockLead(leadId, user)),

  /* Contrataciones: la base «Seguimiento O2» del cliente */
  segOptions: async (force = false): Promise<{ estados: string[]; codigos: string[] }> => (isDemo() ? demo.segOptions() : notion.segOptions(force)),
  segList: async (force = false): Promise<notion.SegRow[]> => (isDemo() ? (demo.segList() as notion.SegRow[]) : notion.segList(force)),
  segGet: async (id: string): Promise<notion.SegRow> => (isDemo() ? (demo.segGet(id) as notion.SegRow) : notion.segGet(id)),
  segAdd: async (values: Partial<Record<notion.SegKey, notion.SegRow[notion.SegKey]>>, file?: File): Promise<notion.SegRow> =>
    isDemo() ? (demo.segAdd(values, file) as notion.SegRow) : notion.segAdd(values, file),
  segSet: async (id: string, values: Partial<Record<notion.SegKey, notion.SegRow[notion.SegKey]>>, file?: File): Promise<notion.SegRow> =>
    isDemo() ? (demo.segSet(id, values, file) as notion.SegRow) : notion.segSet(id, values, file),
  segAddCode: async (name: string): Promise<void> => (isDemo() ? demo.segAddCode(name) : notion.segAddCode(name)),

  /* Portal del empleado: tablas genéricas (las columnas se llaman como en Notion) */
  portalReady: async (): Promise<boolean> => isDemo() || notion.portalReady(),
  rowsList: async (kind: notion.PortalTable, filter?: unknown): Promise<notion.Row[]> =>
    isDemo() ? (demo.rowsList(kind) as notion.Row[]) : notion.rowsList(kind, filter),
  rowGet: async (id: string): Promise<notion.Row> => (isDemo() ? (demo.rowGet(id) as notion.Row) : notion.rowGet(id)),
  rowAdd: async (kind: notion.PortalTable, values: Record<string, notion.Row[string]>, file?: { prop: string; file: File }): Promise<notion.Row> =>
    isDemo() ? (demo.rowAdd(kind, values, file) as notion.Row) : notion.rowAdd(kind, values, file),
  rowSet: async (kind: notion.PortalTable, id: string, values: Record<string, notion.Row[string]>): Promise<notion.Row> =>
    isDemo() ? (demo.rowSet(kind, id, values) as notion.Row) : notion.rowSet(kind, id, values),
  rowDel: async (id: string): Promise<void> => (isDemo() ? demo.rowDel(id) : notion.rowDel(id)),

  logConfigured: async (): Promise<boolean> => isDemo() || notion.logConfigured(),
  addLog: async (e: Omit<CallLog, "id">): Promise<CallLog | null> => (isDemo() ? demo.addLog(e) : notion.addLog(e)),
  getLog: async (from: number): Promise<CallLog[]> => (isDemo() ? demo.getLog(from) : notion.getLog(from)),
};

export const unassignedVisible = () => process.env.COMERCIAL_VE_SIN_ASIGNAR !== "false";
