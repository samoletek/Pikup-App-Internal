import { useMessagingActions as useMessagingActionsContext } from "../contexts/AuthContext";

export const useMessagingActions = () => {
  return useMessagingActionsContext();
};
