import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useSession } from "@/entities/session";
import { ROUTES } from "@/shared/config/routes";
import { PageLoader } from "@/shared/ui/page-loader";

export const ProtectedRoute = () => {
  const { status } = useSession();
  const location = useLocation();

  if (status === "loading") {
    return <PageLoader label="Checking your session…" />;
  }

  if (status === "anonymous") {
    return <Navigate to={ROUTES.login} state={{ from: location }} replace />;
  }

  return <Outlet />;
};
