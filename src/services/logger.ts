export const logger = {
  debug(msg: string, ...args: unknown[]): void {
    console.debug(`[DEBUG] ${msg}`, ...args);
  },

  info(msg: string, ...args: unknown[]): void {
    console.info(`[INFO] ${msg}`, ...args);
  },

  warn(msg: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${msg}`, ...args);
  },

  error(msg: string, ...args: unknown[]): void {
    console.error(`[ERROR] ${msg}`, ...args);
  },
};
