const UNITS = ["B", "KB", "MB", "GB"] as const;

const STEP = 1024;

/** Formats a byte count for display, e.g. 2097152 -> "2 MB". */
export const formatBytes = (bytes: number): string => {
  let value = bytes;
  let unit = 0;

  while (value >= STEP && unit < UNITS.length - 1) {
    value /= STEP;
    unit += 1;
  }

  const rounded = unit === 0 ? value : Math.round(value * 10) / 10;

  return `${rounded} ${UNITS[unit]}`;
};
