import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  buildStoragePath,
  createFileDocument,
  createSignedUpload,
  deleteDocument,
  documentKeys,
  requestIngestion,
  uploadToSignedUrl,
} from "@/entities/document";

export type UploadTask = {
  /** List key only: two files in one batch can share a name. */
  id: string;
  filename: string;
  /** Share of the file that reached Storage, between 0 and 1. */
  progress: number;
};

const DEFAULT_MIME = "application/octet-stream";

const uploadOne = async (
  botId: string,
  file: File,
  onProgress: (ratio: number) => void,
): Promise<void> => {
  const storagePath = buildStoragePath(botId, file.name);

  // The row goes in first so the plan-limit trigger can reject the upload
  // before a single byte travels.
  const document = await createFileDocument({
    botId,
    filename: file.name,
    storagePath,
    mime: file.type || DEFAULT_MIME,
    size: file.size,
  });

  try {
    const { signedUrl } = await createSignedUpload(storagePath);
    await uploadToSignedUrl(signedUrl, file, onProgress);
  } catch (cause) {
    // Without this the dashboard would list a document with no file behind it.
    await deleteDocument(document).catch(() => undefined);
    throw cause;
  }

  // A failed ingest request leaves the row as `pending` so Reindex can retry
  // without asking the user to pick the file again.
  await requestIngestion(document.id);
};

/**
 * Uploads files one after another, exposing per-file progress. Sequential on
 * purpose: parallel uploads would compete for bandwidth and make the progress
 * bars useless on the slow connections this matters on.
 */
export const useUploadDocuments = (botId: string) => {
  const queryClient = useQueryClient();
  const [tasks, setTasks] = useState<UploadTask[]>([]);

  const mutation = useMutation<void, Error, File[]>({
    mutationFn: async (files) => {
      setTasks(
        files.map((file) => ({
          id: crypto.randomUUID(),
          filename: file.name,
          progress: 0,
        })),
      );

      for (const [index, file] of files.entries()) {
        await uploadOne(botId, file, (progress) => {
          setTasks((current) =>
            current.map((task, at) =>
              at === index ? { ...task, progress } : task,
            ),
          );
        });

        await queryClient.invalidateQueries({
          queryKey: documentKeys.list(botId),
        });
      }
    },
    onSettled: async () => {
      // From here on the documents table takes over the reporting.
      setTasks([]);
      await queryClient.invalidateQueries({
        queryKey: documentKeys.list(botId),
      });
    },
  });

  return {
    tasks,
    upload: mutation.mutate,
    isUploading: mutation.isPending,
    error: mutation.error,
  };
};
