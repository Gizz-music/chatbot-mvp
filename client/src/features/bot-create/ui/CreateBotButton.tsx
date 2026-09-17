import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { botLimitMessage, useEntitlements } from "@/entities/plan";
import { buildBotDetailsPath } from "@/shared/config/routes";
import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";
import { UpgradePrompt } from "@/shared/ui/upgrade-prompt";

import { CreateBotForm } from "./CreateBotForm";

import styles from "./CreateBotButton.module.css";

type CreateBotButtonProps = {
  label?: string;
};

export const CreateBotButton = ({
  label = "Create bot",
}: CreateBotButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { plan, isAtLimit, isPending } = useEntitlements();
  const locked = !isPending && isAtLimit("bots");
  const hint = botLimitMessage(plan);

  const close = () => setIsOpen(false);

  return (
    <div className={styles.wrap}>
      <Button
        disabled={locked}
        onClick={() => setIsOpen(true)}
        title={locked ? hint : undefined}
      >
        {label}
      </Button>
      {locked ? (
        <div className={styles.hint}>
          <p className={styles.limit}>{hint}</p>
          <UpgradePrompt />
        </div>
      ) : null}
      {isOpen && !locked ? (
        <Modal onClose={close} title="Create a bot">
          <CreateBotForm
            onCancel={close}
            onCreated={(bot) => {
              close();
              void navigate(buildBotDetailsPath(bot.id));
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
};
