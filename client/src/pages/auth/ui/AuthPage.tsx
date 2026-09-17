import { Navigate, useLocation } from "react-router-dom";

import { AuthForm } from "@/features/auth";
import { useSession } from "@/entities/session";
import { ROUTES } from "@/shared/config/routes";
import { readRedirectPath } from "@/shared/lib/read-redirect-path";
import { Card } from "@/shared/ui/card";
import { Container } from "@/shared/ui/container";
import { PageLoader } from "@/shared/ui/page-loader";

import styles from "./AuthPage.module.css";

export const AuthPage = () => {
  const location = useLocation();
  const { status } = useSession();
  const redirectTo = readRedirectPath(location.state) ?? ROUTES.dashboard;

  if (status === "loading") {
    return <PageLoader label="Checking your session…" />;
  }

  if (status === "authenticated") {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <Container className={styles.page}>
      <h1 className={styles.title}>Sign in to Chatbot Builder</h1>
      <p className={styles.subtitle}>
        Use your e-mail and password, or ask for a one-time sign-in link.
      </p>
      <Card>
        <AuthForm redirectTo={redirectTo} />
      </Card>
    </Container>
  );
};
