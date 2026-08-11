import { DatabaseContext } from '../database';
import { RefreshTokenRepository } from '../database/repositories/RefreshTokenRepository';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import { User, Organization } from '../models/types';
import { UserRole, OrgType, DEMO_ORG_NAME } from '../config/constants';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, 'passwordHash'>;
}

export interface SignupResult extends AuthTokenPair {
  organization: Organization;
}

// ── In-memory failed-login tracker (per process) ─────────────────────────
// For production use move this to Redis or a DB-backed table.
const LOCKOUT_MAX    = 10;        // attempts before lock
const LOCKOUT_MS     = 15 * 60 * 1000; // 15 minutes

interface LockEntry { count: number; lockedUntil: number | null }
const failedAttempts = new Map<string, LockEntry>();

function checkAndRecordFailure(email: string): void {
  const key = email.toLowerCase();
  const entry = failedAttempts.get(key) ?? { count: 0, lockedUntil: null };
  entry.count += 1;
  if (entry.count >= LOCKOUT_MAX) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    logger.warn('Account temporarily locked after repeated failures', { email: key, until: new Date(entry.lockedUntil).toISOString() });
  }
  failedAttempts.set(key, entry);
}

function isLocked(email: string): boolean {
  const entry = failedAttempts.get(email.toLowerCase());
  if (!entry?.lockedUntil) return false;
  if (Date.now() > entry.lockedUntil) {
    // Lock expired — reset
    failedAttempts.delete(email.toLowerCase());
    return false;
  }
  return true;
}

function clearFailures(email: string): void {
  failedAttempts.delete(email.toLowerCase());
}

// Dummy hash used for constant-time comparison when the user does not exist
const DUMMY_HASH = '$2a$12$dummy.hash.that.never.matches.any.real.password.at.all';

export class AuthService {
  private refreshTokenRepo: RefreshTokenRepository;

  constructor(private dbContext: DatabaseContext) {
    this.refreshTokenRepo = new RefreshTokenRepository(dbContext.db);
  }

  // ── Signup: create org + first admin user ──────────────────────────────

  async signup(input: {
    companyName: string;
    orgType: OrgType;
    email: string;
    password: string;
  }): Promise<SignupResult> {
    if (input.companyName.trim() === DEMO_ORG_NAME) {
      throw Object.assign(new Error('That organization name is reserved.'), { status: 409 });
    }

    const { PgDatabase } = await import('../database/pg-adapter');
    const isPostgres = this.dbContext.db instanceof PgDatabase;

    if (isPostgres) {
      const orgs = await (this.dbContext.db as any).queryAsync(
        `SELECT id FROM organizations WHERE name = $1`, [input.companyName.trim()]
      ) as any[];
      if (orgs.length > 0) throw Object.assign(new Error('An organization with that name already exists.'), { status: 409 });

      const users = await (this.dbContext.db as any).queryAsync(
        `SELECT id FROM users WHERE email = $1`, [input.email]
      ) as any[];
      if (users.length > 0) throw Object.assign(new Error('An account with that email already exists.'), { status: 409 });
    } else {
      if (this.dbContext.orgs.findByName(input.companyName.trim())) {
        throw Object.assign(new Error('An organization with that name already exists.'), { status: 409 });
      }
      if (this.dbContext.users.findByEmail(input.email)) {
        throw Object.assign(new Error('An account with that email already exists.'), { status: 409 });
      }
    }

    const org = this.dbContext.orgs.create({ name: input.companyName.trim(), orgType: input.orgType });
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = this.dbContext.users.create({
      email: input.email,
      passwordHash,
      name: input.email.split('@')[0],
      role: UserRole.ADMIN,
      organizationId: org.id,
    });

    logger.info('Organization and admin user created', { orgId: org.id, userId: user.id, email: user.email });
    return { ...this.issueTokenPair(user), organization: org };
  }

  // ── Register (internal / testing) ─────────────────────────────────────

  async register(input: {
    email: string;
    password: string;
    name: string;
    role: string;
    organizationId: string;
  }): Promise<User> {
    if (this.dbContext.users.findByEmail(input.email)) throw new Error('User with this email already exists');
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = this.dbContext.users.create({
      email: input.email, passwordHash, name: input.name,
      role: input.role as UserRole, organizationId: input.organizationId,
    });
    logger.info('User registered', { userId: user.id, email: user.email });
    return user;
  }

  // ── Login ──────────────────────────────────────────────────────────────
  // Security properties guaranteed here:
  //   1. Account lockout after LOCKOUT_MAX failures.
  //   2. Constant-time response whether or not the email exists (prevents
  //      user enumeration via timing).
  //   3. Failure count cleared only on successful auth.

  async login(email: string, password: string): Promise<AuthTokenPair> {
    const genericError = new Error('Invalid email or password');

    // 1. Check lockout first (fast path — no DB query needed)
    if (isLocked(email)) {
      logger.warn('Login attempt on locked account', { email });
      throw genericError;
    }

    // 2. Fetch user — use queryAsync on Postgres to bypass spin-loop
    let user: User | null = null;
    const { PgDatabase } = await import('../database/pg-adapter');
    if (this.dbContext.db instanceof PgDatabase) {
      const rows = await (this.dbContext.db as any).queryAsync(
        `SELECT id, email, password_hash as "passwordHash", role, name,
                organization_id as "organizationId", created_at as "createdAt", updated_at as "updatedAt"
         FROM users WHERE email = $1`, [email]
      ) as User[];
      user = rows[0] ?? null;
    } else {
      user = this.dbContext.users.findByEmail(email);
    }

    // 3. Always run bcrypt.compare to prevent timing-based user enumeration.
    //    If the user doesn't exist, compare against a dummy hash — same cost,
    //    same wall-clock time, result is always false.
    const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!valid || !user) {
      checkAndRecordFailure(email);
      logger.warn('Failed login attempt', { email });
      throw genericError;
    }

    // 4. Successful login — clear failure count
    clearFailures(email);
    logger.info('User logged in', { userId: user.id, email: user.email });
    return this.issueTokenPair(user);
  }

  // ── Refresh token rotation ─────────────────────────────────────────────

  async refresh(rawRefreshToken: string): Promise<AuthTokenPair> {
    const record = this.refreshTokenRepo.findByTokenHash(rawRefreshToken);

    if (!record || record.revoked) {
      if (record) {
        this.refreshTokenRepo.revokeFamily(record.family);
        logger.warn('Refresh token reuse detected — family revoked', { family: record.family });
      }
      throw new Error('Invalid or expired refresh token');
    }

    if (new Date(record.expiresAt) < new Date()) {
      this.refreshTokenRepo.revokeOne(record.id);
      throw new Error('Refresh token expired');
    }

    this.refreshTokenRepo.revokeOne(record.id);

    let user: User | null = null;
    const { PgDatabase } = await import('../database/pg-adapter');
    if (this.dbContext.db instanceof PgDatabase) {
      const rows = await (this.dbContext.db as any).queryAsync(
        `SELECT id, email, password_hash as "passwordHash", role, name,
                organization_id as "organizationId", created_at as "createdAt", updated_at as "updatedAt"
         FROM users WHERE id = $1`, [record.userId]
      ) as User[];
      user = rows[0] ?? null;
    } else {
      user = this.dbContext.users.findById(record.userId);
    }
    if (!user) throw new Error('User not found');
    return this.issueTokenPair(user, record.family);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const record = this.refreshTokenRepo.findByTokenHash(rawRefreshToken);
    if (record) this.refreshTokenRepo.revokeOne(record.id);
  }

  // ── Token verification ─────────────────────────────────────────────────

  verifyToken(token: string): { userId: string; email: string; role: string; organizationId: string } {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      return { userId: decoded.userId, email: decoded.email, role: decoded.role, organizationId: decoded.organizationId };
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

  async getUserByIdAsync(userId: string): Promise<Omit<User, 'passwordHash'> | null> {
    const { PgDatabase } = await import('../database/pg-adapter');
    let user: User | null = null;
    if (this.dbContext.db instanceof PgDatabase) {
      const rows = await (this.dbContext.db as any).queryAsync(
        `SELECT id, email, password_hash as "passwordHash", role, name,
                organization_id as "organizationId", created_at as "createdAt", updated_at as "updatedAt"
         FROM users WHERE id = $1`, [userId]
      ) as User[];
      user = rows[0] ?? null;
    } else {
      user = this.dbContext.users.findById(userId);
    }
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    void passwordHash;
    return rest;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private issueTokenPair(user: User, existingFamily?: string): AuthTokenPair {
    const family = existingFamily ?? uuidv4();
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, organizationId: user.organizationId },
      config.jwtSecret as string,
      { expiresIn: config.jwtAccessExpiresIn as any }
    );
    const rawRefresh = uuidv4() + '-' + uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (parseInt(config.jwtRefreshExpiresIn.replace('d', ''), 10) || 7));
    this.refreshTokenRepo.create(user.id, rawRefresh, family, expiresAt);
    const { passwordHash, ...userSafe } = user;
    void passwordHash;
    return { accessToken, refreshToken: rawRefresh, user: userSafe };
  }

  static getRefreshCookieOptions(isProduction: boolean) {
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    };
  }

  static getClearRefreshCookieOptions(isProduction: boolean) {
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict' as const,
      maxAge: 0,
      path: '/api/auth',
    };
  }
}
