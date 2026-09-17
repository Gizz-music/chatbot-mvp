import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import { documentQueries } from "@/entities/document";
import { documentLimitMessage, useEntitlements } from "@/entities/plan";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { UpgradePrompt } from "@/shared/ui/upgrade-prompt";
import { useToast } from "@/shared/ui/toast";

import { toWebsiteUrl } from "../lib/website-url";
import { useImportWebsite } from "../model/use-import-website";

import styles from "./WebsiteImportForm.module.css";

type WebsiteImportFormProps = {
  botId: string;
};

export const WebsiteImportForm = ({ botId }: WebsiteImportFormProps) => {
  const [address, setAddress] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const { mutate, isPending, error } = useImportWebsite(botId);
  const toast = useToast();
  const { plan, limits } = useEntitlements();
  const documentsQuery = useQuery(documentQueries.list(botId));
  const documentCount = documentsQuery.data?.length ?? 0;
  const atDocumentLimit =
    limits.maxDocuments !== null && documentCount >= limits.maxDocuments;

  const message = atDocumentLimit
    ? documentLimitMessage(plan)
    : (problem ?? error?.message);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (atDocumentLimit) {
      return;
    }

    const url = toWebsiteUrl(address);

    if (!url) {
      setProblem("That does not look like a web address.");
      return;
    }

    setProblem(null);
    mutate(url, {
      onSuccess: () => {
        setAddress("");
        toast.success("Website queued for indexing.");
      },
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <Input
        disabled={isPending || atDocumentLimit}
        id="website-url"
        label="Website URL"
        onChange={(event) => setAddress(event.target.value)}
        placeholder="example.com/docs"
        value={address}
      />
      <p className={styles.hint}>
        One page is indexed as it is. Point at a <code>sitemap.xml</code>{" "}
        instead and the first 20 pages it lists are crawled.
      </p>

      {message ? (
        <p className={styles.error} role="alert">
          {message}
        </p>
      ) : null}
      {atDocumentLimit ? <UpgradePrompt /> : null}

      <div>
        <Button
          disabled={isPending || atDocumentLimit || address.trim().length === 0}
          type="submit"
        >
          {isPending ? "Adding…" : "Add website"}
        </Button>
      </div>
    </form>
  );
};
