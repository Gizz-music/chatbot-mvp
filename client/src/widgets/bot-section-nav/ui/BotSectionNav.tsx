import { NavLink } from "react-router-dom";

import {
  buildBotChatPath,
  buildBotDetailsPath,
  buildBotInsightsPath,
} from "@/shared/config/routes";
import { cx } from "@/shared/lib/cx";

import styles from "./BotSectionNav.module.css";

type BotSectionNavProps = {
  botId: string;
};

export const BotSectionNav = ({ botId }: BotSectionNavProps) => {
  return (
    <nav className={styles.nav} aria-label="Bot sections">
      <NavLink
        className={({ isActive }) => cx(styles.link, isActive && styles.active)}
        end
        to={buildBotDetailsPath(botId)}
      >
        Settings
      </NavLink>
      <NavLink
        className={({ isActive }) => cx(styles.link, isActive && styles.active)}
        to={buildBotChatPath(botId)}
      >
        Chat
      </NavLink>
      <NavLink
        className={({ isActive }) => cx(styles.link, isActive && styles.active)}
        to={buildBotInsightsPath(botId)}
      >
        Insights
      </NavLink>
    </nav>
  );
};
