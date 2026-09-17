import { FunctionsHttpError } from "@supabase/supabase-js";

import { supabase } from "@/shared/api";

import type {
  DocumentSource,
  DocumentStatus,
  KnowledgeDocument,
} from "../model/types";

/** Private bucket created by the 20260916000500 migration. */
const BUCKET = "documents";

const TABLE = "documents";

const INGEST_FUNCTION = "ingest-document";

const DOCUMENT_COLUMNS =
  "id, bot_id, filename, storage_path, source_type, source_url, mime, size, status, error, chunks_count, created_at";

/** Shape of a `public.documents` row. */
type DocumentRow = {
  id: string;
  bot_id: string;
  filename: string;
  storage_path: string | null;
  source_type: DocumentSource;
  source_url: string | null;
  mime: string;
  size: number;
  status: DocumentStatus;
  error: string | null;
  chunks_count: number;
  created_at: string;
};

export type FileDocumentDraft = {
  botId: string;
  filename: string;
  storagePath: string;
  mime: string;
  size: number;
};

export type SignedUpload = {
  path: string;
  signedUrl: string;
};

const toDocument = (row: DocumentRow): KnowledgeDocument => ({
  id: row.id,
  botId: row.bot_id,
  filename: row.filename,
  storagePath: row.storage_path,
  sourceType: row.source_type,
  sourceUrl: row.source_url,
  mime: row.mime,
  size: row.size,
  status: row.status,
  error: row.error,
  chunksCount: row.chunks_count,
  createdAt: row.created_at,
});

export const fetchDocuments = async (
  botId: string,
): Promise<KnowledgeDocument[]> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select(DOCUMENT_COLUMNS)
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .returns<DocumentRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(toDocument);
};

const extensionOf = (filename: string): string => {
  const dot = filename.lastIndexOf(".");

  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
};

/**
 * Objects live under `<bot_id>/…`, which is what the Storage policies check.
 * The random name keeps two uploads of the same file from colliding.
 */
export const buildStoragePath = (botId: string, filename: string): string =>
  `${botId}/${crypto.randomUUID()}${extensionOf(filename)}`;

export const createSignedUpload = async (
  path: string,
): Promise<SignedUpload> => {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error) {
    throw new Error(error.message);
  }

  return { path: data.path, signedUrl: data.signedUrl };
};

/**
 * Uploads through XMLHttpRequest rather than `storage.upload`, because only
 * XHR reports progress events. A signed upload URL expects PUT with the raw
 * file, not the FormData body used by the authenticated `/object` endpoint.
 */
export const uploadToSignedUrl = (
  signedUrl: string,
  file: File,
  onProgress: (ratio: number) => void,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("PUT", signedUrl);
    request.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();
        return;
      }

      reject(new Error(`Upload failed with status ${request.status}.`));
    });

    request.addEventListener("error", () => {
      reject(new Error("Upload failed: the network request did not complete."));
    });

    request.send(file);
  });

const insertDocument = async (
  row: Record<string, unknown>,
): Promise<KnowledgeDocument> => {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select(DOCUMENT_COLUMNS)
    .single<DocumentRow>();

  if (error) {
    throw new Error(error.message);
  }

  return toDocument(data);
};

export const createFileDocument = (
  draft: FileDocumentDraft,
): Promise<KnowledgeDocument> =>
  insertDocument({
    bot_id: draft.botId,
    filename: draft.filename,
    storage_path: draft.storagePath,
    mime: draft.mime,
    size: draft.size,
    source_type: "file",
  });

export const createUrlDocument = (
  botId: string,
  url: string,
): Promise<KnowledgeDocument> => {
  const { host, pathname } = new URL(url);

  return insertDocument({
    bot_id: botId,
    // Shown in the documents table, so it has to stay readable.
    filename: `${host}${pathname === "/" ? "" : pathname}`,
    mime: "text/html",
    // Only known after the crawl, and never used for the plan limit.
    size: 0,
    source_type: "url",
    source_url: url,
  });
};

export const deleteDocument = async (
  document: KnowledgeDocument,
): Promise<void> => {
  if (document.storagePath) {
    // Best-effort: a missing object (failed upload) must not block the row.
    await supabase.storage.from(BUCKET).remove([document.storagePath]);
  }

  const { error } = await supabase.from(TABLE).delete().eq("id", document.id);

  if (error) {
    throw new Error(error.message);
  }
};

/** Unwraps the `{ error }` payload the Edge Function answers with. */
const describeFunctionError = async (cause: unknown): Promise<string> => {
  if (cause instanceof FunctionsHttpError) {
    const payload: unknown = await cause.context.json().catch(() => null);

    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      return payload.error;
    }
  }

  return cause instanceof Error
    ? cause.message
    : "Ingestion could not be started.";
};

/** Hands the document over to the ingest Edge Function and returns at once. */
export const requestIngestion = async (documentId: string): Promise<void> => {
  const { error } = await supabase.functions.invoke(INGEST_FUNCTION, {
    body: { documentId },
  });

  if (error) {
    throw new Error(await describeFunctionError(error));
  }
};
