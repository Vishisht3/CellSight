import { DatabaseContext } from '../database';
import { RefreshTokenRepository } from '../database/repositories/RefreshTokenRepository';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import { User } from '../models/types';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, 'passwordHash'>;
}

export class AuthService {
  private refreshTokenRepo: RefreshTokenRepository;

  constructor(private dbContext: DatabaseContext) {
    this.refreshTokenRepo = new RefreshTokenRepository(dbContext.db);
  }

  async register(input: {
    email: string;
    password: string;
    name: string;
    role: string;
  }): Promise<User> {
    const existing = this.dbContext.users.findByEmail(input.email);
    if (existing) throw new Error('User with this email already exists');

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = this.dbContext.users.create({
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role as any,
    });

    logger.info('User registered', { userId: user.id, email: user.email, role: user.role });
    return user;
  }

  async login(email: string, password: string): Promise<AuthTokenPair> {
    const user = this.dbContext.users.findByEmail(email);
    if (!user) throw new Error('Invalid email or password');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('Invalid email or password');

    logger.info('User logged in', { userId: user.id, email: user.email });

    return this.issueTokenPair(user);
  }

  async refresh(rawRefreshToken: string): Promise<AuthTokenPair> {
    const record = this.refreshTokenRepo.findByTokenHash(rawRefreshToken);

    // Token not found or already revoked → possible reuse attack
    if (!record || record.revoked) {
      if (record) {
        // Revoke entire family to invalidate all sibling tokens
        this.refreshTokenRepo.revokeFamily(record.family);
        logger.warn('Refresh token reuse detected — family revoked', { family: record.family });
      }
      throw new Error('Invalid or expired refresh token');
    }

    // Expired?
    if (new Date(record.expiresAt) < new Date()) {
      this.refreshTokenRepo.revokeOne(record.id);
      throw new Error('Refresh token expired');
    }

    // Rotate: revoke old token, issue new pair in same family
    this.refreshTokenRepo.revokeOne(record.id);

    const user = this.dbContext.users.findById(record.userId);
    if (!user) throw new Error('User not found');

    return this.issueTokenPair(user, record.family);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const record = this.refreshTokenRepo.findByTokenHash(rawRefreshToken);
    if (record) {
      this.refreshTokenRepo.revokeOne(record.id);
    }
  }

  /** Verify an access token and return its payload */
  verifyToken(token: string): { userId: string; email: string; role: string } {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      return { userId: decoded.userId, email: decoded.email, role: decoded.role };
    } catch {
      throw new Error('Invalid or expired token');
    }
  }

  getUserById(userId: string): Omit<User, 'passwordHash'> | null {
    const user = this.dbContext.users.findById(userId);
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    void passwordHash;
    return rest;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private issueTokenPair(user: User, existingFamily?: string): AuthTokenPair {
    const family = existingFamily ?? uuidv4();

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      config.jwtSecret as string,
      { expiresIn: config.jwtAccessExpiresIn as any }
    );

    const rawRefresh = uuidv4() + '-' + uuidv4(); // high-entropy random token
    const expiresAt = new Date();
    const days = parseInt(config.jwtRefreshExpiresIn.replace('d', ''), 10) || 7;
    expiresAt.setDate(expiresAt.getDate() + days);

    this.refreshTokenRepo.create(user.id, rawRefresh, family, expiresAt);

    const { passwordHash, ...userSafe } = user;
    void passwordHash;
    return { accessToken, refreshToken: rawRefresh, user: userSafe };
  }
}
