import { ErrorState } from "@/shared/ui/error-state";

export const NotFoundPage = () => {
  return (
    <ErrorState
      code="404"
      title="Page not found"
      description="The page you are looking for does not exist or has been moved."
    />
  );
};
