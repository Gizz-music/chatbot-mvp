import { useEffect, useId, useRef, type ReactNode } from "react";

import styles from "./Modal.module.css";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Native `<dialog>`, so focus trapping, Escape and the backdrop come from the
 * platform. Render it conditionally — mounting opens it, unmounting closes it
 * and drops whatever state the content held.
 */
export const Modal = ({ title, onClose, children }: ModalProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      aria-labelledby={titleId}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop is reported on the dialog element itself.
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
      ref={dialogRef}
    >
      <header className={styles.head}>
        <h2 className={styles.title} id={titleId}>
          {title}
        </h2>
        <button
          aria-label="Close"
          className={styles.close}
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </header>
      <div className={styles.body}>{children}</div>
    </dialog>
  );
};
