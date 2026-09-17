import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/shared/ui/button";

import styles from "./ChatComposer.module.css";

type ChatComposerProps = {
  disabled?: boolean;
  onSend: (message: string) => void;
};

export const ChatComposer = ({ disabled, onSend }: ChatComposerProps) => {
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const area = areaRef.current;

    if (!area) {
      return;
    }

    area.style.height = "auto";
    area.style.height = `${Math.min(area.scrollHeight, 160)}px`;
  };

  useEffect(() => {
    resize();
  }, []);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();

    const area = areaRef.current;
    const value = area?.value ?? "";

    if (disabled || value.trim().length === 0) {
      return;
    }

    onSend(value);

    if (area) {
      area.value = "";
      resize();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <textarea
        aria-label="Message"
        className={styles.input}
        disabled={disabled}
        onInput={resize}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question…"
        ref={areaRef}
        rows={1}
      />
      <Button
        disabled={disabled}
        style={{ background: "var(--chat-accent, var(--accent))" }}
        type="submit"
      >
        Send
      </Button>
    </form>
  );
};
