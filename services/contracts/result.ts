export type ResultExtras = Record<string, unknown>;

export type ServiceSuccess<T extends ResultExtras = ResultExtras> = {
  success: true;
} & T;

export type ServiceFailure<T extends ResultExtras = ResultExtras> = {
  success: false;
  error: string;
  errorCode: string | null;
} & T;

export const successResult = <T extends ResultExtras = ResultExtras>(
  payload: T = {} as T,
): ServiceSuccess<T> => ({
  success: true,
  ...payload,
});

export const failureResult = <T extends ResultExtras = ResultExtras>(
  error: string,
  errorCode: string | null = null,
  extras: T = {} as T,
): ServiceFailure<T> => ({
  success: false,
  error,
  errorCode,
  ...extras,
});
