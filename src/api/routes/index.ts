import { Router } from 'express';
import authRoutes        from './auth.routes';
import apmRoutes         from './apm.routes';
import supplyChainRoutes from './supply-chain.routes';
import alertRoutes       from './alerts.routes';
import correlationRoutes from './correlation.routes';
import sseRoutes         from './sse.routes';
import { authenticate }      from '../../middleware/auth';
import { config }            from '../../config/environment';
import { getDatabaseContext } from '../../database';
import { PgDatabase }        from '../../database/pg-adapter';

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────
router.use('/auth', authRoutes);

// ── SSE (auth handled inside the route) ──────────────────────────────────
router.use('/sse', sseRoutes);

// ── Protected REST ────────────────────────────────────────────────────────
router.use('/apm',          authenticate, apmRoutes);
router.use('/supply-chain', authenticate, supplyChainRoutes);
router.use('/alerts',       authenticate, alertRoutes);
router.use('/correlation',  authenticate, correlationRoutes);

// ── Health ────────────────────────────────────────────────────────────────
const _startedAt = Date.now();

router.get('/health', async (_req, res) => {
  let dbOk = false;
  try {
    const ctx = await getDatabaseContext();
    // Use async ping for Postgres to avoid blocking the event loop,
    // fall back to sync prepare() for SQLite
    if (ctx.db instanceof PgDatabase) {
      await ctx.db.execAsync('SELECT 1');
    } else {
      ctx.db.prepare('SELECT 1').get();
    }
    dbOk = true;
  } catch { dbOk = false; }

  res.status(dbOk ? 200 : 503).json({
    status:        dbOk ? 'ok' : 'degraded',
    timestamp:     new Date().toISOString(),
    version:       '1.0.0',
    uptimeSeconds: Math.floor((Date.now() - _startedAt) / 1000),
    environment:   config.nodeEnv,
    db:            dbOk ? 'connected' : 'unreachable',
    driver:        config.databaseUrl ? 'postgres' : 'sql.js',
  });
});

export default router;
