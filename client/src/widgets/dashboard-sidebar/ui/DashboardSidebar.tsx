import { NavLink } from "react-router-dom";

import { messageLimitMessage, useEntitlements } from "@/entities/plan";
import { ROUTES } from "@/shared/config/routes";
import { cx } from "@/shared/lib/cx";
import { UpgradePrompt } from "@/shared/ui/upgrade-prompt";

import styles from "./DashboardSidebar.module.css";

export const DashboardSidebar = () => {
  const { plan, limits, usage, isAtLimit, isPending } = useEntitlements();
  const cap = limits.maxMessages;
  const used = usage.messages;
  const ratio = cap === 0 ? 0 : Math.min(used / cap, 1);
  const exhausted = isAtLimit("messages");

  return (
    <aside className={styles.aside} aria-label="Dashboard navigation">
      <NavLink
        className={({ isActive }) => cx(styles.link, isActive && styles.active)}
        end
        to={ROUTES.dashboard}
      >
        My bots
      </NavLink>
      <NavLink
        className={({ isActive }) => cx(styles.link, isActive && styles.active)}
        to={ROUTES.billing}
      >
        Billing
      </NavLink>

      {isPending ? null : (
      <div className={styles.usage}>
        <p className={styles.usageLabel}>Messages this month</p>
        <p className={styles.usageCount}>
          {used.toLocaleString("en-US")} / {cap.toLocaleString("en-US")}
        </p>
        <progress
          aria-label="Message usage"
          className={cx(styles.bar, exhausted && styles.barFull)}
          max={1}
          value={ratio}
        />
        {exhausted ? (
          <div className={styles.upgrade}>
            <p className={styles.limit}>{messageLimitMessage(plan)}</p>
            <UpgradePrompt />
          </div>
        ) : (
          <p className={styles.planName}>{plan.name} plan</p>
        )}
      </div>
      )}
    </aside>
  );
};
