import { Router, Request, Response } from 'express';
import { getDatabaseContext } from '../../database';
import { AuthService } from '../../services/AuthService';
import { userLoginSchema, userRegisterSchema } from '../../utils/validation';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validated = userRegisterSchema.parse(req.body);
    
    const dbContext = getDatabaseContext();
    const authService = new AuthService(dbContext);
    
    const user = await authService.register(validated);
    
    const { passwordHash, ...userWithoutPassword } = user;
    res.status(201).json({ user: userWithoutPassword });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

/**
 * POST /api/auth/login
 * Login and receive JWT token
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validated = userLoginSchema.parse(req.body);
    
    const dbContext = getDatabaseContext();
    const authService = new AuthService(dbContext);
    
    const authToken = await authService.login(validated.email, validated.password);
    
    res.json(authToken);
  } catch (error) {
    if (error instanceof Error) {
      res.status(401).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Login failed' });
    }
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const dbContext = getDatabaseContext();
    const authService = new AuthService(dbContext);
    
    const user = authService.getUserById(req.user.userId);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

export default router;
