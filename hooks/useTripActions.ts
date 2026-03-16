import { useTripActions as useTripActionsContext } from "../contexts/AuthContext";

export const useTripActions = () => {
  return useTripActionsContext();
};
