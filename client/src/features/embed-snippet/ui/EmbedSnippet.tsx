import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";

import { embedKeyOf, snippetOf } from "../lib/snippet";

import styles from "./EmbedSnippet.module.css";

type EmbedSnippetProps = {
  publicKey: string;
};

export const EmbedSnippet = ({ publicKey }: EmbedSnippetProps) => {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const origin = window.location.origin;
  const snippet = snippetOf(origin, publicKey);
  const demoHref = `${origin}/embed-demo.html?bot=${encodeURIComponent(embedKeyOf(publicKey))}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      const area = document.createElement("textarea");
      area.value = snippet;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }

    setCopied(true);
    toast.success("Snippet copied to clipboard.");
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={styles.block}>
      <p className={styles.lead}>
        Paste this on any website. The script opens a bubble that loads the
        widget in an iframe. Use the public key, never the internal id.
      </p>
      <div className={styles.row}>
        <pre className={styles.code}>
          <code>{snippet}</code>
        </pre>
        <Button onClick={() => void copy()} variant="secondary">
          Copy
        </Button>
      </div>
      {copied ? (
        <p className={styles.copied} role="status">
          Copied to clipboard.
        </p>
      ) : null}
      <a
        className={styles.demo}
        href={demoHref}
        rel="noreferrer"
        target="_blank"
      >
        Open on a sample third-party page
      </a>
    </div>
  );
};
