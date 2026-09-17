import { Navigate, useSearchParams } from "react-router-dom";

import { useSession } from "@/entities/session";
import { ROUTES } from "@/shared/config/routes";
import { ErrorState } from "@/shared/ui/error-state";
import { PageLoader } from "@/shared/ui/page-loader";

export const AuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const { status } = useSession();

  const errorDescription = searchParams.get("error_description");
  const redirectTo = searchParams.get("redirectTo") ?? ROUTES.dashboard;

  if (errorDescription) {
    return (
      <ErrorState
        title="This sign-in link did not work"
        description={errorDescription}
      />
    );
  }

  if (status === "loading") {
    return <PageLoader label="Signing you in…" />;
  }

  if (status === "anonymous") {
    return (
      <ErrorState
        title="This sign-in link has expired"
        description="Sign-in links can only be used once and are short-lived. Request a new one and try again."
      />
    );
  }

  return <Navigate to={redirectTo} replace />;
};
