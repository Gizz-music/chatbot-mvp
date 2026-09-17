import { useState, type FormEvent } from "react";

import type { Bot, BotSettings, BotStatus } from "@/entities/bot";
import { useEntitlements } from "@/entities/plan";
import { WidgetPreview } from "@/features/widget-preview";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Gated } from "@/shared/ui/upgrade-prompt";
import { useToast } from "@/shared/ui/toast";

import { formatDomainList, parseDomainList } from "../lib/domain-list";
import { useUpdateBot } from "../model/use-update-bot";

import styles from "./BotSettingsForm.module.css";

type BotSettingsFormProps = {
  bot: Bot;
};

/** Allowed domains live in their own text field, so they stay out of the draft. */
type SettingsDraft = Omit<BotSettings, "allowedDomains">;

const NAME_MAX_LENGTH = 80;

const STATUS_LABELS: Record<BotStatus, string> = {
  draft: "Draft — visible to you only",
  active: "Active — answers visitors",
};

const toDraft = (bot: Bot): SettingsDraft => ({
  name: bot.name,
  description: bot.description,
  systemPrompt: bot.systemPrompt,
  welcomeMessage: bot.welcomeMessage,
  accentColor: bot.accentColor,
  showBranding: bot.showBranding,
  status: bot.status,
});

export const BotSettingsForm = ({ bot }: BotSettingsFormProps) => {
  const [draft, setDraft] = useState<SettingsDraft>(() => toDraft(bot));
  const [domains, setDomains] = useState(() =>
    formatDomainList(bot.allowedDomains),
  );
  const { mutate, isPending, error } = useUpdateBot(bot.id);
  const toast = useToast();
  const { can, isPending: entitlementsPending } = useEntitlements();
  const widgetLocked = !entitlementsPending && !can("widgetCustomization");
  const showBranding = !can("removeBranding");

  const change = <Field extends keyof SettingsDraft>(
    field: Field,
    value: SettingsDraft[Field],
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    mutate(
      {
        ...draft,
        name: draft.name.trim(),
        description: draft.description.trim(),
        welcomeMessage: widgetLocked
          ? bot.welcomeMessage
          : draft.welcomeMessage,
        accentColor: widgetLocked ? bot.accentColor : draft.accentColor,
        allowedDomains: widgetLocked
          ? bot.allowedDomains
          : parseDomainList(domains),
        showBranding,
      },
      { onSuccess: () => toast.success("Settings saved.") },
    );
  };

  return (
    <div className={styles.split}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input
          id="bot-name"
          label="Name"
          maxLength={NAME_MAX_LENGTH}
          onChange={(event) => change("name", event.target.value)}
          required
          value={draft.name}
        />

        <Textarea
          id="bot-description"
          label="Description"
          onChange={(event) => change("description", event.target.value)}
          rows={2}
          value={draft.description}
        />

        <Textarea
          id="bot-system-prompt"
          label="System prompt"
          onChange={(event) => change("systemPrompt", event.target.value)}
          rows={5}
          value={draft.systemPrompt}
        />

        <label className={styles.select} htmlFor="bot-status">
          <span className={styles.label}>Status</span>
          <select
            id="bot-status"
            onChange={(event) =>
              change("status", event.target.value as BotStatus)
            }
            value={draft.status}
          >
            {(Object.keys(STATUS_LABELS) as BotStatus[]).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>

        <Gated
          description="Unlock color, greeting and the domain allow-list."
          locked={widgetLocked}
          title="Upgrade to Pro"
        >
          <div className={styles.widget}>
            <Input
              id="bot-welcome-message"
              label="Welcome message"
              onChange={(event) => change("welcomeMessage", event.target.value)}
              value={draft.welcomeMessage}
            />

            <Input
              className={styles.color}
              id="bot-accent-color"
              label="Accent color"
              onChange={(event) => change("accentColor", event.target.value)}
              type="color"
              value={draft.accentColor}
            />

            <Input
              id="bot-allowed-domains"
              label="Allowed domains"
              onChange={(event) => setDomains(event.target.value)}
              placeholder="example.com, app.example.com"
              value={domains}
            />
            <p className={styles.hint}>
              Comma-separated hosts that may embed the widget. Leave empty to
              allow any. Add <code>localhost</code> to test the snippet locally.
            </p>
          </div>
        </Gated>

        <p className={styles.hint}>
          {showBranding
            ? "Free plans show a “Powered by” badge on the widget. Upgrade to hide it."
            : "Your plan hides the “Powered by” badge on the widget."}
        </p>

        {error ? (
          <p className={styles.error} role="alert">
            {error.message}
          </p>
        ) : null}

        <div className={styles.actions}>
          <Button
            disabled={isPending || draft.name.trim().length === 0}
            type="submit"
          >
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
      <WidgetPreview
        accentColor={draft.accentColor}
        name={draft.name}
        showBranding={showBranding}
        welcomeMessage={draft.welcomeMessage}
      />
    </div>
  );
};
