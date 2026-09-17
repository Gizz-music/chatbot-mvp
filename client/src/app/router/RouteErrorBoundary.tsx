import { isRouteErrorResponse, useRouteError } from "react-router-dom";

import { NotFoundPage } from "@/pages/not-found";
import { ErrorState } from "@/shared/ui/error-state";

export const RouteErrorBoundary = () => {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />;
  }

  return (
    <ErrorState
      title="Something went wrong"
      description="An unexpected error occurred while rendering this page. Try reloading it."
    />
  );
};
