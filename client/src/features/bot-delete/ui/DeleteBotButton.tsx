import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";
import { useToast } from "@/shared/ui/toast";

import { useDeleteBot } from "../model/use-delete-bot";

import styles from "./DeleteBotButton.module.css";

type DeleteBotButtonProps = {
  botId: string;
  botName: string;
};

export const DeleteBotButton = ({ botId, botName }: DeleteBotButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { mutate, isPending, error } = useDeleteBot(botId);
  const toast = useToast();

  const handleConfirm = () => {
    mutate(undefined, {
      onSuccess: () => {
        toast.success("Bot deleted.");
        void navigate(ROUTES.dashboard, { replace: true });
      },
    });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant="danger">
        Delete bot
      </Button>
      {isOpen ? (
        <Modal onClose={() => setIsOpen(false)} title={`Delete “${botName}”?`}>
          <p className={styles.text}>
            The bot, its documents and its chat history are removed for good.
            This cannot be undone.
          </p>

          {error ? (
            <p className={styles.error} role="alert">
              {error.message}
            </p>
          ) : null}

          <div className={styles.actions}>
            <Button
              disabled={isPending}
              onClick={() => setIsOpen(false)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={handleConfirm}
              variant="danger"
            >
              {isPending ? "Deleting…" : "Delete bot"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
};
