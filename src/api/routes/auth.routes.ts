import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDatabaseContext } from '../../database';
import { AuthService } from '../../services/AuthService';
import { OrgType } from '../../config/constants';
import { userLoginSchema, userRegisterSchema } from '../../utils/validation';

const router = Router();

// ── Sign Up (create org + admin user) ─────────────────────────────────────

const signupSchema = z.object({
  companyName: z.string().min(2).max(120),
  orgType: z.nativeEnum(OrgType),
  email: z.string().email(),
  password: z.string().min(8),
});

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const validated = signupSchema.parse(req.body);
    const dbContext = await getDatabaseContext();
    const result = await new AuthService(dbContext).signup(validated);
    res.status(201).json(result);
  } catch (error: any) {
    const status = error?.status ?? (error?.name === 'ZodError' ? 400 : 500);
    const message = error?.issues?.[0]?.message ?? error?.message ?? 'Sign up failed';
    res.status(status).json({ error: message });
  }
});

// ── Register (internal / testing) ─────────────────────────────────────────

router.post('/register', async (req: Request, res: Response) => {
  try {
    const validated = userRegisterSchema.parse(req.body);
    if (!req.body.organizationId) {
      res.status(400).json({ error: 'organizationId is required for registration' });
      return;
    }
    const dbContext = await getDatabaseContext();
    const user = await new AuthService(dbContext).register({
      ...validated,
      organizationId: req.body.organizationId,
    });
    const { passwordHash, ...safe } = user;
    void passwordHash;
    res.status(201).json({ user: safe });
  } catch (error) {
    if (error instanceof Error) res.status(400).json({ error: error.message });
    else res.status(500).json({ error: 'Registration failed' });
  }
});

// ── Login ──────────────────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response) => {
  try {
    const validated = userLoginSchema.parse(req.body);
    const dbContext = await getDatabaseContext();
    const tokens = await new AuthService(dbContext).login(validated.email, validated.password);
    res.json(tokens);
  } catch (error) {
    if (error instanceof Error) res.status(401).json({ error: error.message });
    else res.status(500).json({ error: 'Login failed' });
  }
});

// ── Refresh ────────────────────────────────────────────────────────────────

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { res.status(400).json({ error: 'refreshToken required' }); return; }
    const dbContext = await getDatabaseContext();
    const tokens = await new AuthService(dbContext).refresh(refreshToken);
    res.json(tokens);
  } catch (error) {
    if (error instanceof Error) res.status(401).json({ error: error.message });
    else res.status(500).json({ error: 'Refresh failed' });
  }
});

// ── Logout ─────────────────────────────────────────────────────────────────

router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const dbContext = await getDatabaseContext();
      await new AuthService(dbContext).logout(refreshToken);
    }
    res.json({ message: 'Logged out' });
  } catch {
    res.json({ message: 'Logged out' });
  }
});

// ── Me ─────────────────────────────────────────────────────────────────────

router.get('/me', async (req: Request, res: Response) => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const dbContext = await getDatabaseContext();
    const user = await new AuthService(dbContext).getUserByIdAsync(req.user.userId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ user });
  } catch { res.status(500).json({ error: 'Failed to get user info' }); }
});

export default router;
