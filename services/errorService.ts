import { Alert } from "react-native";
import { logger } from "./logger";

export type AppErrorInput = unknown;

export type NormalizedAppError = {
  message: string;
  code?: string;
};

export const normalizeError = (
  error: AppErrorInput,
  fallbackMessage = "Something went wrong. Please try again."
): NormalizedAppError => {
  if (!error) {
    return { message: fallbackMessage };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    return {
      message: error.message || fallbackMessage,
      code,
    };
  }

  if (typeof error === "object") {
    const candidate = error as {
      message?: string;
      error?: string;
      details?: string;
      code?: string;
    };

    return {
      message: candidate.message || candidate.error || candidate.details || fallbackMessage,
      code: candidate.code,
    };
  }

  return { message: fallbackMessage };
};

export const showErrorAlert = (
  title: string,
  error: AppErrorInput,
  fallbackMessage?: string
) => {
  const normalized = normalizeError(error, fallbackMessage);
  logger.error("ErrorService", normalized.message, error);
  Alert.alert(title, normalized.message);
};

export const showInfoAlert = (title: string, message: string) => {
  Alert.alert(title, message);
};

export const showConfirmAlert = (
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = "Continue"
) => {
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: confirmText, onPress: onConfirm },
  ]);
};
