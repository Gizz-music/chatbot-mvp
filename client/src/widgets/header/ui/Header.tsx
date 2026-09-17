import { Link, NavLink, useLocation } from "react-router-dom";

import { useSession } from "@/entities/session";
import { ROUTES } from "@/shared/config/routes";
import { cx } from "@/shared/lib/cx";
import { Container } from "@/shared/ui/container";

import { UserMenu } from "./UserMenu";

import styles from "./Header.module.css";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cx(styles.link, isActive && styles.active);

const LANDING_LINKS = [
  { hash: "#how-it-works", label: "How it works" },
  { hash: "#demo", label: "Demo" },
  { hash: "#pricing", label: "Pricing" },
] as const;

export const Header = () => {
  const { status, user } = useSession();
  const location = useLocation();
  const onDashboard = location.pathname.startsWith("/dashboard");
  const showMarketing = !onDashboard;

  return (
    <header className={styles.header}>
      <Container className={styles.inner}>
        <NavLink className={styles.brand} to={ROUTES.landing}>
          Chatbot Builder
        </NavLink>

        <nav className={styles.nav} aria-label="Main navigation">
          {showMarketing
            ? LANDING_LINKS.map((item) => (
                <Link
                  className={styles.link}
                  key={item.hash}
                  preventScrollReset
                  to={{ pathname: ROUTES.landing, hash: item.hash }}
                >
                  {item.label}
                </Link>
              ))
            : null}

          {status === "authenticated" && user ? (
            <>
              <NavLink className={navLinkClass} to={ROUTES.dashboard}>
                Dashboard
              </NavLink>
              {onDashboard ? (
                <NavLink className={navLinkClass} to={ROUTES.billing}>
                  Billing
                </NavLink>
              ) : null}
              <UserMenu user={user} />
            </>
          ) : null}

          {status === "anonymous" ? (
            <>
              <Link className={styles.link} to={ROUTES.login}>
                Log in
              </Link>
              <Link className={styles.signUp} to={ROUTES.login}>
                Sign up
              </Link>
            </>
          ) : null}
        </nav>
      </Container>
    </header>
  );
};
