import { Router, Request, Response } from 'express';
import { getDatabaseContext } from '../../database';
import { AuthService } from '../../services/AuthService';
import { userLoginSchema, userRegisterSchema } from '../../utils/validation';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const validated = userRegisterSchema.parse(req.body);
    const dbContext = await getDatabaseContext();
    const authService = new AuthService(dbContext);
    const user = await authService.register(validated);
    const { passwordHash: _p, ...userWithoutPassword } = user;
    res.status(201).json({ user: userWithoutPassword });
  } catch (error) {
    if (error instanceof Error) res.status(400).json({ error: error.message });
    else res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const validated = userLoginSchema.parse(req.body);
    const dbContext = await getDatabaseContext();
    const authService = new AuthService(dbContext);
    const authToken = await authService.login(validated.email, validated.password);
    res.json(authToken);
  } catch (error) {
    if (error instanceof Error) res.status(401).json({ error: error.message });
    else res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', async (req: Request, res: Response) => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const dbContext = await getDatabaseContext();
    const user = new AuthService(dbContext).getUserById(req.user.userId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ user });
  } catch (error) { res.status(500).json({ error: 'Failed to get user info' }); }
});

export default router;
