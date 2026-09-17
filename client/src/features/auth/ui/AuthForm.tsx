import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";

import { cx } from "@/shared/lib/cx";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import {
  signInWithMagicLink,
  signInWithPassword,
  signUpWithPassword,
} from "../api/auth-api";

import styles from "./AuthForm.module.css";

type AuthMode = "sign-in" | "sign-up";

type AuthFormProps = {
  /** Where the user should land once the session is established. */
  redirectTo: string;
};

const MODE_LABELS: Record<AuthMode, string> = {
  "sign-in": "Sign in",
  "sign-up": "Sign up",
};

export const AuthForm = ({ redirectTo }: AuthFormProps) => {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: async (): Promise<string | null> => {
      if (mode === "sign-in") {
        await signInWithPassword({ email, password });

        return null;
      }

      const { needsEmailConfirmation } = await signUpWithPassword({
        email,
        password,
        fullName,
        redirectTo,
      });

      return needsEmailConfirmation
        ? "Almost there — confirm your e-mail address to finish signing up."
        : null;
    },
    onSuccess: (message) => setNotice(message),
  });

  const magicLinkMutation = useMutation({
    mutationFn: () => signInWithMagicLink({ email, redirectTo }),
    onSuccess: () => setNotice(`Magic link sent to ${email}.`),
  });

  const isPending = submitMutation.isPending || magicLinkMutation.isPending;
  const error = submitMutation.error ?? magicLinkMutation.error;

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setNotice(null);
    submitMutation.reset();
    magicLinkMutation.reset();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    magicLinkMutation.reset();
    submitMutation.mutate();
  };

  const handleMagicLink = () => {
    setNotice(null);
    submitMutation.reset();
    magicLinkMutation.mutate();
  };

  return (
    <div className={styles.auth}>
      <div
        className={styles.modes}
        role="group"
        aria-label="Authentication mode"
      >
        {(Object.keys(MODE_LABELS) as AuthMode[]).map((value) => (
          <button
            key={value}
            type="button"
            className={cx(styles.mode, mode === value && styles.modeActive)}
            aria-pressed={mode === value}
            onClick={() => switchMode(value)}
          >
            {MODE_LABELS[value]}
          </button>
        ))}
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {mode === "sign-up" ? (
          <Input
            autoComplete="name"
            id="full-name"
            label="Full name"
            name="fullName"
            onChange={(event) => setFullName(event.target.value)}
            required
            value={fullName}
          />
        ) : null}

        <Input
          autoComplete="email"
          id="email"
          label="E-mail"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />

        <Input
          autoComplete={
            mode === "sign-in" ? "current-password" : "new-password"
          }
          id="password"
          label="Password"
          minLength={8}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />

        <Button disabled={isPending} type="submit">
          {MODE_LABELS[mode]}
        </Button>
      </form>

      <div className={styles.magicLink}>
        <p className={styles.hint}>
          Prefer no password? We can e-mail you a one-time sign-in link.
        </p>
        <Button
          disabled={isPending || email.length === 0}
          onClick={handleMagicLink}
          variant="secondary"
        >
          Email me a magic link
        </Button>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error.message}
        </p>
      ) : null}
      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
};
