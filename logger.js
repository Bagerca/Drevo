export class Logger {
  static info(message, data = '') { console.log(`[TreeInfo] ${message}`, data); }
  static warn(message, data = '') { console.warn(`[TreeWarn] ${message}`, data); }
  static error(message, err = '') { console.error(`[TreeError] ${message}`, err); }
}