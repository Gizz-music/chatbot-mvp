import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.116.0";

import { chunkText } from "./chunk.ts";
import { embedAll } from "../_shared/gemini.ts";
import { assertDocumentQuota, PlanLimitError } from "../_shared/entitlements.ts";
import { extractDocumentText } from "./extract.ts";
import { corsHeaders, jsonResponse, messageOf, requireEnv } from "./http.ts";
import type { DocumentRow } from "./types.ts";

// Provided by the Supabase edge runtime, which ships no ambient types.
declare const EdgeRuntime: { waitUntil: (task: Promise<unknown>) => void };

const DOCUMENT_COLUMNS =
  "id, bot_id, filename, storage_path, source_type, source_url, size";

/** Rows per insert, so a large document does not travel in one giant request. */
const INSERT_BATCH_SIZE = 100;

const failOn = (error: { message: string } | null) => {
  if (error) {
    throw new Error(error.message);
  }
};

const storeChunks = async (
  admin: SupabaseClient,
  document: DocumentRow,
  chunks: string[],
  embeddings: number[][],
) => {
  const rows = chunks.map((content, index) => ({
    bot_id: document.bot_id,
    document_id: document.id,
    content,
    embedding: embeddings[index],
    metadata: {
      index,
      filename: document.filename,
      source: document.source_url ?? document.filename,
    },
  }));

  for (let at = 0; at < rows.length; at += INSERT_BATCH_SIZE) {
    const { error } = await admin
      .from("chunks")
      .insert(rows.slice(at, at + INSERT_BATCH_SIZE));

    failOn(error);
  }
};

/**
 * Everything that happens after the response was sent: parse, split, embed,
 * store. Whatever goes wrong ends up in documents.error, where the dashboard
 * picks it up — a failure is never swallowed.
 */
const ingest = async (admin: SupabaseClient, document: DocumentRow) => {
  try {
    const text = (await extractDocumentText(admin, document)).trim();
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error(
        "No readable text found. A scanned PDF has to go through OCR first.",
      );
    }

    // Re-ingesting replaces the previous vectors instead of duplicating them.
    failOn(
      (await admin.from("chunks").delete().eq("document_id", document.id)).error,
    );

    await storeChunks(admin, document, chunks, await embedAll(chunks));

    failOn(
      (
        await admin
          .from("documents")
          .update({ status: "ready", error: null, chunks_count: chunks.length })
          .eq("id", document.id)
      ).error,
    );
  } catch (cause) {
    const message = messageOf(cause);
    console.error(`ingest-document failed for ${document.id}: ${message}`);

    // A half-written batch must not stay retrievable after the document fails.
    await admin.from("chunks").delete().eq("document_id", document.id);

    await admin
      .from("documents")
      .update({ status: "failed", error: message, chunks_count: 0 })
      .eq("id", document.id);
  }
};

const readDocumentId = async (request: Request): Promise<string | null> => {
  try {
    const { documentId } = await request.json();

    return typeof documentId === "string" ? documentId : null;
  } catch {
    return null;
  }
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Use POST." }, 405);
  }

  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    return jsonResponse({ error: "Missing Authorization header." }, 401);
  }

  const documentId = await readDocumentId(request);

  if (!documentId) {
    return jsonResponse({ error: "Expected a documentId string." }, 400);
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");

  // Reading as the caller *is* the authorisation check: row level security only
  // hands the row over when the signed-in user owns the bot behind it.
  const asCaller = createClient(supabaseUrl, requireEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authorization } },
  });

  const { data: document, error } = await asCaller
    .from("documents")
    .select(DOCUMENT_COLUMNS)
    .eq("id", documentId)
    .maybeSingle<DocumentRow>();

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  if (!document) {
    return jsonResponse({ error: "Document not found." }, 404);
  }

  const admin = createClient(
    supabaseUrl,
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  try {
    await assertDocumentQuota(admin, document.bot_id, document.size);
  } catch (cause) {
    if (cause instanceof PlanLimitError) {
      return jsonResponse({ error: cause.message }, cause.status);
    }

    return jsonResponse({ error: messageOf(cause) }, 500);
  }

  const { error: processingError } = await admin
    .from("documents")
    .update({ status: "processing", error: null, chunks_count: 0 })
    .eq("id", document.id);

  if (processingError) {
    return jsonResponse({ error: processingError.message }, 500);
  }

  // Parsing and embedding outlive the response; the dashboard polls for status.
  EdgeRuntime.waitUntil(ingest(admin, document));

  return jsonResponse({ status: "processing" }, 202);
});
