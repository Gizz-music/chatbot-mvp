import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { SessionUser } from "@/entities/session";
import { useSignOut } from "@/features/auth";
import { ROUTES } from "@/shared/config/routes";

import styles from "./UserMenu.module.css";

type UserMenuProps = {
  user: SessionUser;
};

const getDisplayName = (user: SessionUser) =>
  user.fullName ?? user.email ?? "Account";

export const UserMenu = ({ user }: UserMenuProps) => {
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const signOutMutation = useSignOut();

  const displayName = getDisplayName(user);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className={styles.menu} ref={containerRef}>
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={styles.trigger}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {user.avatarUrl ? (
          <img alt="" className={styles.avatar} src={user.avatarUrl} />
        ) : (
          <span aria-hidden="true" className={styles.avatar}>
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}
        <span className={styles.triggerLabel}>{displayName}</span>
      </button>

      {isOpen ? (
        <div className={styles.dropdown} id={menuId} role="menu">
          <p className={styles.email}>{user.email}</p>
          <Link
            className={styles.item}
            onClick={() => setIsOpen(false)}
            role="menuitem"
            to={ROUTES.dashboard}
          >
            Dashboard
          </Link>
          <Link
            className={styles.item}
            onClick={() => setIsOpen(false)}
            role="menuitem"
            to={ROUTES.billing}
          >
            Billing
          </Link>
          <button
            className={styles.item}
            disabled={signOutMutation.isPending}
            onClick={() => signOutMutation.mutate()}
            role="menuitem"
            type="button"
          >
            {signOutMutation.isPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
};
