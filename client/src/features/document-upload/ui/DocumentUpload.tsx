import { useQuery } from "@tanstack/react-query";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { documentQueries } from "@/entities/document";
import { documentLimitMessage, useEntitlements } from "@/entities/plan";
import { cx } from "@/shared/lib/cx";
import { formatBytes } from "@/shared/lib/format-bytes";
import { Button } from "@/shared/ui/button";
import { UpgradePrompt } from "@/shared/ui/upgrade-prompt";
import { useToast } from "@/shared/ui/toast";

import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_LABEL,
  validateFiles,
} from "../lib/file-validation";
import { useUploadDocuments } from "../model/use-upload-documents";

import styles from "./DocumentUpload.module.css";

type DocumentUploadProps = {
  botId: string;
};

export const DocumentUpload = ({ botId }: DocumentUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const { plan, limits, isPending: entitlementsPending } = useEntitlements();
  const documentsQuery = useQuery(documentQueries.list(botId));
  const { tasks, upload, isUploading, error } = useUploadDocuments(botId);
  const toast = useToast();

  const documentCount = documentsQuery.data?.length ?? 0;
  const atDocumentLimit =
    limits.maxDocuments !== null && documentCount >= limits.maxDocuments;
  const canPick = !entitlementsPending && !isUploading && !atDocumentLimit;

  const handleFiles = (files: File[]) => {
    if (isUploading || files.length === 0 || atDocumentLimit) {
      return;
    }

    const { accepted, problems: rejected } = validateFiles(
      files,
      limits,
      documentCount,
    );

    setProblems(rejected);

    if (accepted.length > 0) {
      upload(accepted, {
        onSuccess: () =>
          toast.success(
            accepted.length === 1
              ? "File uploaded. Indexing has started."
              : "Files uploaded. Indexing has started.",
          ),
      });
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles([...(event.target.files ?? [])]);
    // Lets the same file be picked again after a failed attempt.
    event.target.value = "";
  };

  const openPicker = () => {
    if (canPick) {
      inputRef.current?.click();
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    handleFiles([...event.dataTransfer.files]);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    // Without this the browser navigates to the dropped file.
    event.preventDefault();
  };

  const handleDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);

    if (dragDepth.current === 0) {
      setIsDragging(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div
        className={cx(
          styles.dropzone,
          isDragging && styles.dragging,
          !canPick && styles.busy,
        )}
        onClick={openPicker}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <p className={styles.prompt}>Drop files here</p>
        <Button
          disabled={!canPick}
          onClick={(event) => {
            event.stopPropagation();
            openPicker();
          }}
          variant="secondary"
        >
          {isUploading ? "Uploading…" : "Choose files"}
        </Button>
        <input
          accept={ACCEPT_ATTRIBUTE}
          className={styles.input}
          multiple
          onChange={handleChange}
          ref={inputRef}
          type="file"
        />
        <p className={styles.hint}>
          {ACCEPTED_LABEL}
          {` — up to ${formatBytes(limits.maxFileBytes)} per file on the ${plan.name} plan`}
        </p>
      </div>

      {tasks.length > 0 ? (
        <ul className={styles.tasks}>
          {tasks.map((task) => (
            <li className={styles.task} key={task.id}>
              <span className={styles.taskName}>{task.filename}</span>
              <progress
                className={styles.progress}
                max={1}
                value={task.progress}
              />
              <span className={styles.taskShare}>
                {Math.round(task.progress * 100)}%
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error.message}
        </p>
      ) : null}

      {atDocumentLimit ? (
        <div>
          <p className={styles.error} role="status">
            {documentLimitMessage(plan)}
          </p>
          <UpgradePrompt />
        </div>
      ) : null}

      {problems.length > 0 ? (
        <ul className={styles.problems} role="alert">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
