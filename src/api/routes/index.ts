import { Router } from 'express';
import authRoutes        from './auth.routes';
import apmRoutes         from './apm.routes';
import supplyChainRoutes from './supply-chain.routes';
import alertRoutes       from './alerts.routes';
import correlationRoutes from './correlation.routes';
import sseRoutes         from './sse.routes';
import qmsRoutes         from './qms.routes';
import netZeroRoutes     from './net-zero.routes';
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
router.use('/qms',          authenticate, qmsRoutes);
router.use('/net-zero',     authenticate, netZeroRoutes);

// ── Health ────────────────────────────────────────────────────────────────
const _startedAt = Date.now();

router.get('/health', async (_req, res) => {
  let dbOk = false;
  try {
    const ctx = await getDatabaseContext();
    // Use queryAsync for Postgres — execAsync goes through the DDL splitter
    // which adds unnecessary overhead on the hot health path.
    if (ctx.db instanceof PgDatabase) {
      await (ctx.db as any).queryAsync('SELECT 1');
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
