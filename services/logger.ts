type LogArgs = unknown[];
const isDev = typeof __DEV__ !== "undefined" && __DEV__ === true;

const emit = (method: "log" | "info" | "warn" | "error", scope: string, args: LogArgs) => {
  const prefix = `[${scope}]`;
  console[method](prefix, ...args);
};

export const logger = {
  debug(scope: string, ...args: LogArgs) {
    if (!isDev) return;
    emit("log", scope, args);
  },
  info(scope: string, ...args: LogArgs) {
    if (!isDev) return;
    emit("info", scope, args);
  },
  warn(scope: string, ...args: LogArgs) {
    emit("warn", scope, args);
  },
  error(scope: string, ...args: LogArgs) {
    emit("error", scope, args);
  },
};
