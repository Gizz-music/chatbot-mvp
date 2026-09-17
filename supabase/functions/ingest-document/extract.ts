import type { SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";
import mammoth from "npm:mammoth@1.12.3";
import { extractText as extractPdfText, getDocumentProxy } from "npm:unpdf@1.8.1";
import { Buffer } from "node:buffer";

import { messageOf } from "./http.ts";
import type { DocumentRow } from "./types.ts";
import { fetchWebsiteText } from "./website.ts";

export const DOCUMENTS_BUCKET = "documents";

/**
 * Upper bound on the text handed to the splitter. An edge worker has 256 MB and
 * a couple of seconds of CPU, so a novel-sized upload is truncated rather than
 * allowed to kill the whole ingestion.
 */
const MAX_CHARACTERS = 400_000;

const extensionOf = (filename: string): string =>
  filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();

const fromPdf = async (bytes: Uint8Array): Promise<string> => {
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractPdfText(pdf, { mergePages: true });

    return text;
  } catch (cause) {
    throw new Error(`Could not parse the PDF: ${messageOf(cause)}`);
  }
};

const fromDocx = async (bytes: Uint8Array): Promise<string> => {
  try {
    // Outside the browser mammoth only accepts a Node Buffer.
    const { value } = await mammoth.extractRawText({
      buffer: Buffer.from(bytes),
    });

    return value;
  } catch (cause) {
    throw new Error(`Could not parse the DOCX: ${messageOf(cause)}`);
  }
};

const fromStoredFile = async (
  admin: SupabaseClient,
  document: DocumentRow,
): Promise<string> => {
  if (!document.storage_path) {
    throw new Error("The document has no file in Storage.");
  }

  const { data, error } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .download(document.storage_path);

  if (error) {
    throw new Error(`Could not download the file: ${error.message}`);
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  const extension = extensionOf(document.filename);

  switch (extension) {
    case "pdf":
      return fromPdf(bytes);
    case "docx":
      return fromDocx(bytes);
    case "md":
    case "txt":
    case "csv":
      return new TextDecoder().decode(bytes);
    default:
      throw new Error(`Unsupported file type: .${extension}`);
  }
};

const fromWebsite = (document: DocumentRow): Promise<string> => {
  if (!document.source_url) {
    throw new Error("The document has no source URL.");
  }

  return fetchWebsiteText(document.source_url);
};

/** Plain text of a document, whatever it was uploaded or crawled from. */
export const extractDocumentText = async (
  admin: SupabaseClient,
  document: DocumentRow,
): Promise<string> => {
  const text =
    document.source_type === "url"
      ? await fromWebsite(document)
      : await fromStoredFile(admin, document);

  return text.length > MAX_CHARACTERS ? text.slice(0, MAX_CHARACTERS) : text;
};
