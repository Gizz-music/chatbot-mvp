import { getPlanById, type PlanLimits } from "@/entities/plan";
import { formatBytes } from "@/shared/lib/format-bytes";

/** Everything the ingest Edge Function knows how to parse. */
const ACCEPTED_EXTENSIONS: readonly string[] = [
  ".pdf",
  ".docx",
  ".md",
  ".txt",
  ".csv",
];

export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(",");

export const ACCEPTED_LABEL = ACCEPTED_EXTENSIONS.map((extension) =>
  extension.slice(1).toUpperCase(),
).join(", ");

export type FileSelection = {
  accepted: File[];
  /** One message per rejected file, ready to be shown as-is. */
  problems: string[];
};

const extensionOf = (filename: string): string => {
  const dot = filename.lastIndexOf(".");

  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
};

/**
 * Checked by extension, not by MIME type: browsers disagree on what a `.md` or
 * `.csv` file is, and some report nothing at all.
 */
const rejectionReason = (file: File, limits: PlanLimits): string | null => {
  if (!ACCEPTED_EXTENSIONS.includes(extensionOf(file.name))) {
    return `${file.name}: only ${ACCEPTED_LABEL} files can be indexed.`;
  }

  if (file.size === 0) {
    return `${file.name} is empty.`;
  }

  if (file.size > limits.maxFileBytes) {
    const planName = getPlanById(limits.planId).name;

    return `${file.name} is ${formatBytes(file.size)}, but the ${planName} plan allows ${formatBytes(limits.maxFileBytes)} per file.`;
  }

  return null;
};

export const validateFiles = (
  files: File[],
  limits: PlanLimits,
  existingCount = 0,
): FileSelection => {
  const accepted: File[] = [];
  const problems: string[] = [];
  const remaining =
    limits.maxDocuments === null
      ? Number.POSITIVE_INFINITY
      : Math.max(0, limits.maxDocuments - existingCount);

  for (const file of files) {
    const reason = rejectionReason(file, limits);

    if (reason) {
      problems.push(reason);
      continue;
    }

    if (limits.maxDocuments !== null && accepted.length >= remaining) {
      problems.push(
        `${file.name}: the ${getPlanById(limits.planId).name} plan allows ${limits.maxDocuments} documents per bot.`,
      );
      continue;
    }

    accepted.push(file);
  }

  return { accepted, problems };
};
