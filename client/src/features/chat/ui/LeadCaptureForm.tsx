import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { captureWidgetLead } from "@/entities/lead";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { markLeadSubmitted } from "../lib/lead-flag";

import styles from "./LeadCaptureForm.module.css";

type LeadCaptureFormProps = {
  publicKey: string;
  conversationId: string | null;
  onCaptured: () => void;
};

export const LeadCaptureForm = ({
  publicKey,
  conversationId,
  onCaptured,
}: LeadCaptureFormProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const capture = useMutation({
    mutationFn: captureWidgetLead,
    onSuccess: () => {
      markLeadSubmitted(publicKey);
      onCaptured();
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    capture.mutate({
      publicKey,
      email: email.trim(),
      name: name.trim(),
      conversationId,
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <p className={styles.copy}>
        Want a follow-up? Leave a contact and the bot owner can reach you.
      </p>
      <div className={styles.fields}>
        <Input
          autoComplete="name"
          disabled={capture.isPending}
          id="lead-name"
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          value={name}
        />
        <Input
          autoComplete="email"
          disabled={capture.isPending}
          id="lead-email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          required
          type="email"
          value={email}
        />
        <Button
          disabled={capture.isPending || email.trim().length === 0}
          type="submit"
        >
          {capture.isPending ? "Sending…" : "Send"}
        </Button>
      </div>
      {capture.error ? (
        <p className={styles.error} role="alert">
          {capture.error.message}
        </p>
      ) : null}
    </form>
  );
};
