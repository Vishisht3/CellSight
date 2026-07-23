/**
 * Structured JSON logger with secret scrubbing.
 * In development it emits human-readable lines; in production it emits
 * newline-delimited JSON for log aggregators (Render, Fly, Datadog, etc.).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Patterns whose values should be replaced before logging
const SECRET_KEYS = /password|token|secret|authorization|cookie|jwt/i;

function scrub(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    // Redact anything that looks like a Bearer token or raw JWT
    return obj.replace(/Bearer\s+[\w.-]+/gi, 'Bearer [REDACTED]')
              .replace(/eyJ[\w.-]{20,}/g, '[JWT_REDACTED]');
  }
  if (Array.isArray(obj)) return obj.map(v => scrub(v, depth + 1));
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? '[REDACTED]' : scrub(v, depth + 1);
    }
    return out;
  }
  return obj;
}

const isDev = process.env.NODE_ENV !== 'production';

function emit(level: LogLevel, message: string, meta?: unknown): void {
  const ts = new Date().toISOString();
  const scrubbedMeta = meta !== undefined ? scrub(meta) : undefined;

  if (isDev) {
    const prefix = { debug: '🔍', info: '✅', warn: '⚠️ ', error: '❌' }[level];
    const metaStr = scrubbedMeta ? ' ' + JSON.stringify(scrubbedMeta) : '';
    const line = `[${ts}] ${prefix} ${message}${metaStr}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  } else {
    // Production: newline-delimited JSON for log drains
    const entry: Record<string, unknown> = { ts, level, message };
    if (scrubbedMeta) entry.meta = scrubbedMeta;
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}

export const logger = {
  debug: (msg: string, meta?: unknown) => {
    if (isDev) emit('debug', msg, meta);
  },
  info:  (msg: string, meta?: unknown) => emit('info',  msg, meta),
  warn:  (msg: string, meta?: unknown) => emit('warn',  msg, meta),
  error: (msg: string, meta?: unknown) => emit('error', msg, meta),
};
