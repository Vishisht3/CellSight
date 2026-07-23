import rateLimit from 'express-rate-limit';
import { config } from '../config/environment';

/** General API rate limit — 300 req / 15 min per IP */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: () => !config.isProduction, // no limiting in local dev
});

/** Tight limit on auth endpoints — 20 attempts / 15 min per IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
  skip: () => !config.isProduction,
});

/** Telemetry ingest — 500 req / min per IP (batch-friendly) */
export const telemetryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Telemetry rate limit exceeded.' },
  skip: () => !config.isProduction,
});
