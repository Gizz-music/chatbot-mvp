/**
 * The embeddings API counts tokens, this splitter counts characters. Four
 * characters per token is a usual rule of thumb for LLM tokenisers and keeps
 * the ingestion free of a tokenizer dependency.
 */
const CHARS_PER_TOKEN = 4;
const CHUNK_TOKENS = 800;
const OVERLAP_TOKENS = 100;

const CHUNK_SIZE = CHUNK_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_SIZE = OVERLAP_TOKENS * CHARS_PER_TOKEN;

const SEPARATOR = "\n\n";

/** Last resort for a paragraph that is one long wall of text. */
const splitOversized = (paragraph: string): string[] => {
  const sentences = paragraph.match(/[^.!?]+[.!?]*\s*/g) ?? [paragraph];
  const parts: string[] = [];

  for (const sentence of sentences) {
    if (sentence.length <= CHUNK_SIZE) {
      parts.push(sentence);
      continue;
    }

    for (let at = 0; at < sentence.length; at += CHUNK_SIZE) {
      parts.push(sentence.slice(at, at + CHUNK_SIZE));
    }
  }

  return parts;
};

/** Smallest units the packer is allowed to move around, each within the budget. */
const toSegments = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .flatMap((paragraph) =>
      paragraph.length <= CHUNK_SIZE ? [paragraph] : splitOversized(paragraph),
    );

/**
 * Tail of the chunk that was just closed. Repeating it at the start of the next
 * one keeps a fact that straddles the seam retrievable from either side.
 */
const overlapFrom = (segments: string[]): string[] => {
  const tail: string[] = [];
  let length = 0;

  for (let at = segments.length - 1; at >= 0; at -= 1) {
    const segment = segments[at];

    if (length + segment.length > OVERLAP_SIZE) {
      // One oversized segment still contributes its ending, so the seam is
      // never left without any context at all.
      if (tail.length === 0) {
        tail.push(segment.slice(-OVERLAP_SIZE));
      }

      break;
    }

    tail.unshift(segment);
    length += segment.length;
  }

  return tail;
};

const totalLength = (segments: string[]): number =>
  segments.reduce((total, segment) => total + segment.length, 0);

/** Packs the text into ~800 token chunks that overlap by ~100 tokens. */
export const chunkText = (text: string): string[] => {
  const chunks: string[] = [];

  let current: string[] = [];
  let currentLength = 0;
  // Segments added since the last flush. Without it a trailing overlap would be
  // emitted a second time as a chunk of its own.
  let freshCount = 0;

  for (const segment of toSegments(text)) {
    if (freshCount > 0 && currentLength + segment.length > CHUNK_SIZE) {
      chunks.push(current.join(SEPARATOR));
      current = overlapFrom(current);
      currentLength = totalLength(current);
      freshCount = 0;
    }

    current.push(segment);
    currentLength += segment.length;
    freshCount += 1;
  }

  if (freshCount > 0) {
    chunks.push(current.join(SEPARATOR));
  }

  return chunks;
};
