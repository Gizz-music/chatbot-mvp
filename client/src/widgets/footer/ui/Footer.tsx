import { Link } from "react-router-dom";

import { ROUTES } from "@/shared/config/routes";
import { Container } from "@/shared/ui/container";

import styles from "./Footer.module.css";

export const Footer = () => {
  return (
    <footer className={styles.footer}>
      <Container className={styles.inner}>
        <span>Chatbot Builder</span>
        <nav className={styles.links} aria-label="Landing sections">
          <Link
            className={styles.link}
            preventScrollReset
            to={{ pathname: ROUTES.landing, hash: "#how-it-works" }}
          >
            How it works
          </Link>
          <Link
            className={styles.link}
            preventScrollReset
            to={{ pathname: ROUTES.landing, hash: "#demo" }}
          >
            Demo
          </Link>
          <Link
            className={styles.link}
            preventScrollReset
            to={{ pathname: ROUTES.landing, hash: "#pricing" }}
          >
            Pricing
          </Link>
        </nav>
      </Container>
    </footer>
  );
};
