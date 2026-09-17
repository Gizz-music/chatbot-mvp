import type { SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";

import { embedQuery } from "../_shared/gemini.ts";
import type { MatchedChunk } from "./types.ts";

const MATCH_COUNT = 6;
const MIN_SIMILARITY = 0.05;
const MAX_CHUNK_CHARS = 1_200;

const GROUNDING_RULES = `Grounding rules you must follow:
- Answer using only the knowledge base excerpts provided with this turn.
- If the excerpts do not contain the answer, say you do not have that information in the uploaded documents.
- Do not invent facts, prices, URLs, policies, names, or steps.
- If the excerpts are about a related but different topic, do not stretch them into an answer.`;

const EMPTY_KB_RULES = `The knowledge base returned no relevant excerpts for this question.
- If the user is greeting you or asking how this chat works, reply briefly and offer to help with questions covered by the documents.
- Otherwise say you do not have that information in the uploaded documents.
- Do not invent product facts, prices, URLs, policies, or names.`;

export const retrieveChunks = async (
  admin: SupabaseClient,
  botId: string,
  question: string,
): Promise<MatchedChunk[]> => {
  const embedding = await embedQuery(question);
  const { data, error } = await admin.rpc("match_chunks", {
    query_embedding: embedding,
    match_bot_id: botId,
    match_count: MATCH_COUNT,
    min_similarity: MIN_SIMILARITY,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as MatchedChunk[];
};

const clip = (content: string): string =>
  content.length > MAX_CHUNK_CHARS
    ? `${content.slice(0, MAX_CHUNK_CHARS)}…`
    : content;

export const buildSystemPrompt = (
  botPrompt: string,
  chunks: MatchedChunk[],
): string => {
  const base = `${botPrompt.trim()}\n\n`;

  if (chunks.length === 0) {
    return `${base}${EMPTY_KB_RULES}`;
  }

  const excerpts = chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] ${chunk.filename}\n${clip(chunk.content)}`,
    )
    .join("\n\n");

  return `${base}${GROUNDING_RULES}\n\nKnowledge base excerpts:\n${excerpts}`;
};

export const citationsOf = (chunks: MatchedChunk[]) => {
  const seen = new Set<string>();
  const citations: { document_id: string; filename: string }[] = [];

  for (const chunk of chunks) {
    if (seen.has(chunk.document_id)) {
      continue;
    }

    seen.add(chunk.document_id);
    citations.push({
      document_id: chunk.document_id,
      filename: chunk.filename,
    });
  }

  return citations;
};
