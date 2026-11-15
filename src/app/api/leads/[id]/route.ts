import { NextResponse } from "next/server";
import { handle, requireSession } from "@/lib/auth";
import { cleanFields, visibleLead } from "@/lib/leadRules";
import { store } from "@/lib/store";

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireSession();
  const { id } = await ctx.params;
  const current = await visibleLead(me, id);
  const body = (await req.json().catch(() => ({}))) as { fields?: Record<string, unknown> };
  const fields = cleanFields(body.fields ?? {}, me, current);
  return NextResponse.json({ lead: await store.updateLead(id, fields) });
});
