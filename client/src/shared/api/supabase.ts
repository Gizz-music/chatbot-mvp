import { createClient } from "@supabase/supabase-js";

import { env } from "@/shared/config/env";

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Lets the client finish the magic-link / e-mail confirmation flow
    // when the user lands back on /auth/callback.
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
