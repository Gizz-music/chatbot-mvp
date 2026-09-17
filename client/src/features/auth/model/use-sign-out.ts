import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { ROUTES } from "@/shared/config/routes";

import { signOut } from "../api/auth-api";

export const useSignOut = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      void navigate(ROUTES.landing, { replace: true });
    },
  });
};
