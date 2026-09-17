import { supabase } from "@/shared/api";

import type { Lead } from "../model/types";

type LeadRow = {
  id: string;
  bot_id: string;
  conversation_id: string | null;
  email: string;
  name: string | null;
  created_at: string;
};

const toLead = (row: LeadRow): Lead => ({
  id: row.id,
  botId: row.bot_id,
  conversationId: row.conversation_id,
  email: row.email,
  name: row.name,
  createdAt: row.created_at,
});

export const fetchLeads = async (botId: string): Promise<Lead[]> => {
  const { data, error } = await supabase
    .from("leads")
    .select("id, bot_id, conversation_id, email, name, created_at")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .returns<LeadRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(toLead);
};

export const deleteLead = async (id: string): Promise<void> => {
  const { error } = await supabase.from("leads").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
};

export const captureWidgetLead = async (input: {
  publicKey: string;
  email: string;
  name?: string;
  conversationId?: string | null;
}): Promise<void> => {
  const { error } = await supabase.rpc("capture_widget_lead", {
    p_public_key: input.publicKey,
    p_email: input.email,
    p_name: input.name || null,
    p_conversation_id: input.conversationId || null,
  });

  if (error) {
    throw new Error(error.message);
  }
};
