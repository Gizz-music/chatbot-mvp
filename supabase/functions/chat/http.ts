export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const requireEnv = (name: string): string => {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing environment variable ${name}.`);
  }

  return value;
};

export const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

const encoder = new TextEncoder();

export const sseHeaders = {
  ...corsHeaders,
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

export const encodeSse = (payload: unknown): Uint8Array =>
  encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
