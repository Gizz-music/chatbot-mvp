import { useQuery } from "@tanstack/react-query";

import {
  documentQueries,
  isDocumentPending,
  type DocumentStatus,
  type KnowledgeDocument,
} from "@/entities/document";
import { cx } from "@/shared/lib/cx";
import { formatBytes } from "@/shared/lib/format-bytes";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { StateMessage } from "@/shared/ui/state-message";
import { useToast } from "@/shared/ui/toast";

import {
  useDeleteDocument,
  useRetryIngestion,
} from "../model/use-document-actions";

import styles from "./DocumentList.module.css";

type DocumentListProps = {
  botId: string;
};

const STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: "Queued",
  processing: "Indexing…",
  ready: "Ready",
  failed: "Failed",
};

export const DocumentList = ({ botId }: DocumentListProps) => {
  const toast = useToast();
  const {
    data: documents,
    isPending,
    isError,
    error,
  } = useQuery(documentQueries.list(botId));

  const remove = useDeleteDocument(botId);
  const retry = useRetryIngestion(botId);

  if (isPending) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading documents"
        className={styles.wrapper}
      >
        <div className={styles.skeletonList}>
          <Skeleton height="1.1rem" width="40%" />
          <Skeleton height="1.1rem" width="70%" />
          <Skeleton height="1.1rem" width="55%" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <StateMessage
        description={error.message}
        title="Could not load the documents"
        tone="error"
      />
    );
  }

  if (documents.length === 0) {
    return (
      <StateMessage
        description="Upload a PDF, DOCX, Markdown, TXT or CSV above — or import a website. The bot cannot answer until something is indexed."
        title="Nothing indexed yet"
      />
    );
  }

  const isBusy = (document: KnowledgeDocument) =>
    (remove.isPending && remove.variables.id === document.id) ||
    (retry.isPending && retry.variables === document.id);

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Status</th>
            <th className={styles.numeric} scope="col">
              Chunks
            </th>
            <th className={styles.numeric} scope="col">
              Size
            </th>
            <th scope="col">
              <span className={styles.srOnly}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id}>
              <td>
                <span className={styles.filename}>{document.filename}</span>
                {document.sourceType === "url" ? (
                  <span className={styles.badge}>website</span>
                ) : null}
                {document.error ? (
                  <p className={styles.error}>{document.error}</p>
                ) : null}
              </td>
              <td>
                <span
                  className={cx(
                    styles.status,
                    document.status === "ready" && styles.ready,
                    document.status === "failed" && styles.failed,
                    isDocumentPending(document) && styles.working,
                  )}
                >
                  {STATUS_LABELS[document.status]}
                </span>
              </td>
              <td className={styles.numeric}>{document.chunksCount}</td>
              <td className={styles.numeric}>
                {document.size > 0 ? formatBytes(document.size) : "—"}
              </td>
              <td className={styles.actions}>
                {isDocumentPending(document) ? null : (
                  <Button
                    disabled={isBusy(document)}
                    onClick={() =>
                      retry.mutate(document.id, {
                        onSuccess: () => toast.success("Reindexing started."),
                      })
                    }
                    variant="ghost"
                  >
                    Reindex
                  </Button>
                )}
                <Button
                  disabled={isBusy(document)}
                  onClick={() =>
                    remove.mutate(document, {
                      onSuccess: () => toast.success("Document deleted."),
                    })
                  }
                  variant="ghost"
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {remove.error ? (
        <p className={styles.actionError} role="alert">
          {remove.error.message}
        </p>
      ) : null}
      {retry.error ? (
        <p className={styles.actionError} role="alert">
          {retry.error.message}
        </p>
      ) : null}
    </div>
  );
};
