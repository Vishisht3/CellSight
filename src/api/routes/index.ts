import { Router } from 'express';
import authRoutes from './auth.routes';
import apmRoutes from './apm.routes';
import supplyChainRoutes from './supply-chain.routes';
import alertRoutes from './alerts.routes';
import correlationRoutes from './correlation.routes';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Public routes
router.use('/auth', authRoutes);

// Protected routes (require authentication)
router.use('/apm', authenticate, apmRoutes);
router.use('/supply-chain', authenticate, supplyChainRoutes);
router.use('/alerts', authenticate, alertRoutes);
router.use('/correlation', authenticate, correlationRoutes);

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

export default router;
