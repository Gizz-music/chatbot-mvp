export type DocumentSource = "file" | "url";

/** The columns ingest-document needs from a `public.documents` row. */
export type DocumentRow = {
  id: string;
  bot_id: string;
  filename: string;
  storage_path: string | null;
  source_type: DocumentSource;
  source_url: string | null;
  size: number;
};
