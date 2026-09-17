import { useState, type FormEvent } from "react";

import type { Bot } from "@/entities/bot";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { useToast } from "@/shared/ui/toast";

import { useCreateBot } from "../model/use-create-bot";

import styles from "./CreateBotForm.module.css";

type CreateBotFormProps = {
  onCreated: (bot: Bot) => void;
  onCancel: () => void;
};

const NAME_MAX_LENGTH = 80;

export const CreateBotForm = ({ onCreated, onCancel }: CreateBotFormProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { mutate, isPending, error } = useCreateBot();
  const toast = useToast();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    mutate(
      { name: name.trim(), description: description.trim() },
      {
        onSuccess: (bot) => {
          toast.success("Bot created. Upload a document next.");
          onCreated(bot);
        },
      },
    );
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <Input
        autoFocus
        id="create-bot-name"
        label="Name"
        maxLength={NAME_MAX_LENGTH}
        onChange={(event) => setName(event.target.value)}
        placeholder="Support bot"
        required
        value={name}
      />

      <Textarea
        id="create-bot-description"
        label="Description"
        onChange={(event) => setDescription(event.target.value)}
        placeholder="What this bot helps with. Visible to you only."
        rows={3}
        value={description}
      />

      {error ? (
        <p className={styles.error} role="alert">
          {error.message}
        </p>
      ) : null}

      <div className={styles.actions}>
        <Button disabled={isPending} onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button disabled={isPending || name.trim().length === 0} type="submit">
          {isPending ? "Creating…" : "Create bot"}
        </Button>
      </div>
    </form>
  );
};
