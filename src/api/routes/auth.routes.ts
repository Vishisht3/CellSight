import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDatabaseContext } from '../../database';
import { AuthService } from '../../services/AuthService';
import { OrgType } from '../../config/constants';
import { userLoginSchema, userRegisterSchema } from '../../utils/validation';
import { config } from '../../config/environment';

const router = Router();

// ── Sign Up (create org + admin user) ─────────────────────────────────────

const signupSchema = z.object({
  companyName: z.string().min(2).max(120),
  orgType: z.nativeEnum(OrgType),
  email: z.string().email(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .refine(
      pw => /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw),
      'Password must contain at least one number or special character'
    ),
});

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const validated = signupSchema.parse(req.body);
    const dbContext = await getDatabaseContext();
    const result = await new AuthService(dbContext).signup(validated);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, AuthService.getRefreshCookieOptions(config.isProduction));

    // Return only access token + user info in body
    const { refreshToken, ...safeResult } = result;
    void refreshToken;
    res.status(201).json(safeResult);
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

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, AuthService.getRefreshCookieOptions(config.isProduction));

    // Return only access token in body (short-lived, safe for memory storage)
    res.json({ accessToken: tokens.accessToken, user: tokens.user });
  } catch (error) {
    if (error instanceof Error) res.status(401).json({ error: error.message });
    else res.status(500).json({ error: 'Login failed' });
  }
});

// ── Refresh ────────────────────────────────────────────────────────────────

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // Read refresh token from httpOnly cookie
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) { res.status(401).json({ error: 'No refresh token' }); return; }

    const dbContext = await getDatabaseContext();
    const tokens = await new AuthService(dbContext).refresh(refreshToken);

    // Set new refresh token as httpOnly cookie (rotation)
    res.cookie('refreshToken', tokens.refreshToken, AuthService.getRefreshCookieOptions(config.isProduction));

    // Return only access token in body
    res.json({ accessToken: tokens.accessToken, user: tokens.user });
  } catch (error) {
    // Clear invalid cookie
    res.clearCookie('refreshToken', AuthService.getClearRefreshCookieOptions(config.isProduction));
    if (error instanceof Error) res.status(401).json({ error: error.message });
    else res.status(500).json({ error: 'Refresh failed' });
  }
});

// ── Logout ─────────────────────────────────────────────────────────────────

router.post('/logout', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      const dbContext = await getDatabaseContext();
      await new AuthService(dbContext).logout(refreshToken);
    }
    // Clear the refresh token cookie
    res.clearCookie('refreshToken', AuthService.getClearRefreshCookieOptions(config.isProduction));
    res.json({ message: 'Logged out' });
  } catch {
    // Even on error, clear the cookie
    res.clearCookie('refreshToken', AuthService.getClearRefreshCookieOptions(config.isProduction));
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
