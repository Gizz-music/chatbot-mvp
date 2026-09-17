export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

/** An uploaded file, or a web page the crawler pulled in. */
export type DocumentSource = "file" | "url";

/**
 * Named after the knowledge base rather than the table, so it does not read as
 * the DOM `Document` at every call site.
 */
export type KnowledgeDocument = {
  id: string;
  botId: string;
  filename: string;
  storagePath: string | null;
  sourceType: DocumentSource;
  sourceUrl: string | null;
  mime: string;
  size: number;
  status: DocumentStatus;
  /** Why ingestion failed, straight from the Edge Function. */
  error: string | null;
  chunksCount: number;
  createdAt: string;
};

/** Waiting for, or already inside, the ingest Edge Function. */
export const isDocumentPending = (document: KnowledgeDocument): boolean =>
  document.status === "pending" || document.status === "processing";
