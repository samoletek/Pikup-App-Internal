export class AppError extends Error {
  code: string | null;
  cause?: unknown;

  constructor(message: string, code: string | null = null, cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }
}

export const toAppError = (
  error: unknown,
  fallbackMessage = 'Unexpected error',
): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message || fallbackMessage, null, error);
  }

  return new AppError(fallbackMessage, null, error);
};
