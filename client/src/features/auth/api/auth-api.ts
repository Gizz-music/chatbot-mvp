import { supabase } from "@/shared/api";
import { ROUTES } from "@/shared/config/routes";

type Credentials = {
  email: string;
  password: string;
};

type SignUpParams = Credentials & {
  fullName: string;
  redirectTo: string;
};

type MagicLinkParams = {
  email: string;
  redirectTo: string;
};

/**
 * Where Supabase sends the user back after a magic link or a confirmation
 * e-mail. The target path travels along so the callback can restore it.
 */
const buildCallbackUrl = (redirectTo: string): string => {
  const url = new URL(ROUTES.authCallback, window.location.origin);
  url.searchParams.set("redirectTo", redirectTo);

  return url.toString();
};

export const signInWithPassword = async ({ email, password }: Credentials) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(error.message);
  }
};

export const signUpWithPassword = async ({
  email,
  password,
  fullName,
  redirectTo,
}: SignUpParams): Promise<{ needsEmailConfirmation: boolean }> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: buildCallbackUrl(redirectTo),
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return { needsEmailConfirmation: data.session === null };
};

export const signInWithMagicLink = async ({
  email,
  redirectTo,
}: MagicLinkParams) => {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: buildCallbackUrl(redirectTo) },
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
};
