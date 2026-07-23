import { Router, Request, Response } from 'express';
import { getDatabaseContext } from '../../database';
import { AuthService } from '../../services/AuthService';
import { userLoginSchema, userRegisterSchema } from '../../utils/validation';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const validated = userRegisterSchema.parse(req.body);
    const dbContext = await getDatabaseContext();
    const user = await new AuthService(dbContext).register(validated);
    const { passwordHash: _p, ...safe } = user;
    res.status(201).json({ user: safe });
  } catch (error) {
    if (error instanceof Error) res.status(400).json({ error: error.message });
    else res.status(500).json({ error: 'Registration failed' });
  }
});

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

/**
 * POST /api/auth/refresh
 * Body: { refreshToken: string }
 * Returns new accessToken + refreshToken pair (rotation).
 */
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

/**
 * POST /api/auth/logout
 * Body: { refreshToken: string }
 * Revokes the provided refresh token.
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const dbContext = await getDatabaseContext();
      await new AuthService(dbContext).logout(refreshToken);
    }
    res.json({ message: 'Logged out' });
  } catch {
    res.json({ message: 'Logged out' }); // always succeed from client's perspective
  }
});

router.get('/me', async (req: Request, res: Response) => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const dbContext = await getDatabaseContext();
    const user = new AuthService(dbContext).getUserById(req.user.userId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ user });
  } catch { res.status(500).json({ error: 'Failed to get user info' }); }
});

export default router;
