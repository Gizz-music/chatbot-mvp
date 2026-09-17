const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta";
const CHAT_MODEL = "gemini-3.5-flash-lite";
const EMBEDDING_MODEL = "gemini-embedding-001";

/** Has to match `extensions.vector(1536)` on public.chunks. */
const DIMENSIONS = 1536;

/** Chunks per request. Gemini accepts up to 100; stay well below free-tier RPM. */
const EMBED_BATCH_SIZE = 32;

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type GeminiRole = "user" | "model";

type GeminiPart = {
  text?: string;
  thought?: boolean;
};

type EmbedResponse = {
  embedding?: { values?: number[] };
};

type BatchEmbedResponse = {
  embeddings?: { values?: number[] }[];
};

type StreamChunk = {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

type EmbeddingTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

const apiKey = (): string => {
  const value = Deno.env.get("GEMINI_API_KEY");

  if (!value) {
    throw new Error("Missing environment variable GEMINI_API_KEY.");
  }

  return value;
};

const geminiHeaders = (): HeadersInit => ({
  "Content-Type": "application/json",
  "x-goog-api-key": apiKey(),
});

const modelUrl = (model: string, method: string, query = ""): string =>
  `${GEMINI_URL}/models/${model}:${method}${query}`;

/**
 * Truncated gemini-embedding-001 vectors are not unit-length. Cosine search
 * in pgvector expects normalised embeddings.
 */
const l2Normalize = (vector: number[]): number[] => {
  let sumSquares = 0;

  for (const value of vector) {
    sumSquares += value * value;
  }

  const magnitude = Math.sqrt(sumSquares);

  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
};

const readVector = (values: number[] | undefined, label: string): number[] => {
  if (!values || values.length !== DIMENSIONS) {
    throw new Error(`${label} returned no ${DIMENSIONS}-dimension vector.`);
  }

  return l2Normalize(values);
};

const embedRequestOf = (text: string, taskType: EmbeddingTask) => ({
  model: `models/${EMBEDDING_MODEL}`,
  content: { parts: [{ text }] },
  taskType,
  outputDimensionality: DIMENSIONS,
});

const embedOne = async (
  text: string,
  taskType: EmbeddingTask,
): Promise<number[]> => {
  const response = await fetch(modelUrl(EMBEDDING_MODEL, "embedContent"), {
    method: "POST",
    headers: geminiHeaders(),
    body: JSON.stringify(embedRequestOf(text, taskType)),
  });

  if (!response.ok) {
    throw new Error(
      `Embeddings API answered ${response.status}: ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as EmbedResponse;

  return readVector(payload.embedding?.values, "Embeddings API");
};

const embedBatch = async (
  batch: string[],
  taskType: EmbeddingTask,
): Promise<number[][]> => {
  const response = await fetch(modelUrl(EMBEDDING_MODEL, "batchEmbedContents"), {
    method: "POST",
    headers: geminiHeaders(),
    body: JSON.stringify({
      requests: batch.map((text) => embedRequestOf(text, taskType)),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Embeddings API answered ${response.status}: ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as BatchEmbedResponse;
  const embeddings = payload.embeddings ?? [];

  if (embeddings.length !== batch.length) {
    throw new Error(
      `Embeddings API returned ${embeddings.length} vectors for ${batch.length} chunks.`,
    );
  }

  return embeddings.map((item, index) =>
    readVector(item.values, `Embeddings API (chunk ${index})`),
  );
};

export const embedQuery = (input: string): Promise<number[]> =>
  embedOne(input, "RETRIEVAL_QUERY");

export const embedAll = async (inputs: string[]): Promise<number[][]> => {
  const vectors: number[][] = [];

  for (let at = 0; at < inputs.length; at += EMBED_BATCH_SIZE) {
    vectors.push(
      ...(await embedBatch(
        inputs.slice(at, at + EMBED_BATCH_SIZE),
        "RETRIEVAL_DOCUMENT",
      )),
    );
  }

  return vectors;
};

const contentsOf = (
  history: ChatTurn[],
  question: string,
): { role: GeminiRole; parts: { text: string }[] }[] => {
  const turns: { role: GeminiRole; parts: { text: string }[] }[] = [];

  const push = (role: GeminiRole, text: string) => {
    const last = turns[turns.length - 1];

    if (last?.role === role) {
      last.parts[0].text += `\n${text}`;
      return;
    }

    turns.push({ role, parts: [{ text }] });
  };

  for (const item of history) {
    push(item.role === "assistant" ? "model" : "user", item.content);
  }

  push("user", question);

  while (turns[0]?.role === "model") {
    turns.shift();
  }

  return turns;
};

const textOf = (chunk: StreamChunk): string => {
  const parts = chunk.candidates?.[0]?.content?.parts ?? [];

  return parts
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text ?? "")
    .join("");
};

export async function* streamCompletion(
  system: string,
  history: ChatTurn[],
  question: string,
): AsyncGenerator<string> {
  const response = await fetch(
    modelUrl(CHAT_MODEL, "streamGenerateContent", "?alt=sse"),
    {
      method: "POST",
      headers: geminiHeaders(),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: contentsOf(history, question),
        generationConfig: {
          thinkingConfig: { thinkingLevel: "MINIMAL" },
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Chat API answered ${response.status}: ${await response.text()}`,
    );
  }

  if (!response.body) {
    throw new Error("Chat API returned an empty body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed.startsWith("data:")) {
        continue;
      }

      const data = trimmed.slice(5).trim();

      if (!data || data === "[DONE]") {
        continue;
      }

      const payload = JSON.parse(data) as StreamChunk;

      if (payload.error?.message) {
        throw new Error(payload.error.message);
      }

      if (payload.promptFeedback?.blockReason) {
        throw new Error(
          `Gemini blocked the prompt (${payload.promptFeedback.blockReason}).`,
        );
      }

      const delta = textOf(payload);

      if (delta) {
        yield delta;
      }
    }
  }
}
