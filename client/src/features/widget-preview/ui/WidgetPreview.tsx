import { useState } from "react";

import styles from "./WidgetPreview.module.css";

export type WidgetPreviewProps = {
  name: string;
  welcomeMessage: string;
  accentColor: string;
  showBranding: boolean;
};

const CloseIcon = ({ size }: { size: number }) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
  >
    <path
      d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.2"
    />
  </svg>
);

export const WidgetPreview = ({
  name,
  welcomeMessage,
  accentColor,
  showBranding,
}: WidgetPreviewProps) => {
  const [open, setOpen] = useState(true);

  return (
    <div className={styles.stage}>
      <p className={styles.site}>Live preview — changes apply as you type.</p>
      <div className={styles.panel} data-open={open ? "true" : "false"}>
        <div className={styles.top} style={{ background: accentColor }}>
          <p className={styles.name}>{name || "Bot"}</p>
          <button
            aria-label="Close preview chat"
            className={styles.close}
            onClick={() => setOpen(false)}
            type="button"
          >
            <CloseIcon size={14} />
          </button>
        </div>
        <div className={styles.body}>
          <p className={styles.welcome}>
            {welcomeMessage || "Hi! How can I help you today?"}
          </p>
          <p className={styles.composer}>Ask a question…</p>
          {showBranding ? (
            <p className={styles.brand}>Powered by Chatbot Builder</p>
          ) : null}
        </div>
      </div>
      <button
        aria-expanded={open}
        aria-label={open ? "Close preview chat" : "Open preview chat"}
        className={styles.bubble}
        onClick={() => setOpen((current) => !current)}
        style={{ background: accentColor }}
        type="button"
      >
        {open ? (
          <CloseIcon size={18} />
        ) : (
          <svg
            aria-hidden="true"
            fill="none"
            height={22}
            viewBox="0 0 24 24"
            width={22}
          >
            <path
              d="M5 6.8A2.8 2.8 0 0 1 7.8 4h8.4A2.8 2.8 0 0 1 19 6.8v6.4A2.8 2.8 0 0 1 16.2 16H9l-4 3.2V6.8Z"
              fill="currentColor"
            />
          </svg>
        )}
      </button>
    </div>
  );
};
