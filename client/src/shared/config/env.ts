const requireEnv = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy client/.env.example to client/.env.local and fill it in.`,
    );
  }

  return value;
};

const optionalEnv = (value: string | undefined): string | null => {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
};

export const env = {
  supabaseUrl: requireEnv(
    "VITE_SUPABASE_URL",
    import.meta.env.VITE_SUPABASE_URL,
  ),
  supabaseAnonKey: requireEnv(
    "VITE_SUPABASE_ANON_KEY",
    import.meta.env.VITE_SUPABASE_ANON_KEY,
  ),
  /**
   * Public key of the bot shown on the landing page. Train it on
   * `docs/product.md` so visitors can try the product before they sign up.
   */
  demoBotPublicKey: optionalEnv(import.meta.env.VITE_DEMO_BOT_PUBLIC_KEY),
} as const;
