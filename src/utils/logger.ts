type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: any;
}

class Logger {
  private formatLog(level: LogLevel, message: string, meta?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
    };
  }

  info(message: string, meta?: any): void {
    const log = this.formatLog('info', message, meta);
    console.log(`[${log.timestamp}] INFO: ${log.message}`, meta ? meta : '');
  }

  warn(message: string, meta?: any): void {
    const log = this.formatLog('warn', message, meta);
    console.warn(`[${log.timestamp}] WARN: ${log.message}`, meta ? meta : '');
  }

  error(message: string, meta?: any): void {
    const log = this.formatLog('error', message, meta);
    console.error(`[${log.timestamp}] ERROR: ${log.message}`, meta ? meta : '');
  }

  debug(message: string, meta?: any): void {
    if (process.env.NODE_ENV === 'development') {
      const log = this.formatLog('debug', message, meta);
      console.debug(`[${log.timestamp}] DEBUG: ${log.message}`, meta ? meta : '');
    }
  }
}

export const logger = new Logger();
