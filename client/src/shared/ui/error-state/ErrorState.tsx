import { Link } from "react-router-dom";

import { ROUTES } from "@/shared/config/routes";
import { Container } from "@/shared/ui/container";

import styles from "./ErrorState.module.css";

type ErrorStateProps = {
  code?: string;
  title: string;
  description: string;
};

export const ErrorState = ({ code, title, description }: ErrorStateProps) => {
  return (
    <Container className={styles.state}>
      {code ? <p className={styles.code}>{code}</p> : null}
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
      <Link className={styles.link} to={ROUTES.landing}>
        Back to home
      </Link>
    </Container>
  );
};
