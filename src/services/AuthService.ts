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

export class AuthService {
  private refreshTokenRepo: RefreshTokenRepository;

  constructor(private dbContext: DatabaseContext) {
    this.refreshTokenRepo = new RefreshTokenRepository(dbContext.db);
  }

  // ── Sign-up: create org + first admin user ─────────────────────────────

  async signup(input: {
    companyName: string;
    orgType: OrgType;
    email: string;
    password: string;
  }): Promise<SignupResult> {
    // Block reserved demo org name
    if (input.companyName.trim() === DEMO_ORG_NAME) {
      throw Object.assign(new Error('That organization name is reserved.'), { status: 409 });
    }

    // Use queryAsync on Postgres to bypass the Atomics spin-loop
    const { PgDatabase } = await import('../database/pg-adapter');
    const isPostgres = this.dbContext.db instanceof PgDatabase;

    if (isPostgres) {
      const orgs = await (this.dbContext.db as any).queryAsync(
        `SELECT id FROM organizations WHERE name = $1`, [input.companyName.trim()]
      ) as any[];
      if (orgs.length > 0) throw Object.assign(new Error(`An organization named "${input.companyName}" already exists.`), { status: 409 });
      const users = await (this.dbContext.db as any).queryAsync(
        `SELECT id FROM users WHERE email = $1`, [input.email]
      ) as any[];
      if (users.length > 0) throw Object.assign(new Error('A user with that email already exists.'), { status: 409 });
    } else {
      const existing = this.dbContext.orgs.findByName(input.companyName.trim());
      if (existing) throw Object.assign(new Error(`An organization named "${input.companyName}" already exists.`), { status: 409 });
      const existingUser = this.dbContext.users.findByEmail(input.email);
      if (existingUser) throw Object.assign(new Error('A user with that email already exists.'), { status: 409 });
    }

    const org = this.dbContext.orgs.create({
      name: input.companyName.trim(),
      orgType: input.orgType,
    });

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = this.dbContext.users.create({
      email: input.email,
      passwordHash,
      name: input.email.split('@')[0], // default display name from email prefix
      role: UserRole.ADMIN,
      organizationId: org.id,
    });

    logger.info('Organization and admin user created', {
      orgId: org.id,
      orgName: org.name,
      userId: user.id,
      email: user.email,
    });

    const tokens = this.issueTokenPair(user);
    return { ...tokens, organization: org };
  }

  // ── Register (internal / testing use) ─────────────────────────────────

  async register(input: {
    email: string;
    password: string;
    name: string;
    role: string;
    organizationId: string;
  }): Promise<User> {
    const existing = this.dbContext.users.findByEmail(input.email);
    if (existing) throw new Error('User with this email already exists');

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = this.dbContext.users.create({
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role as UserRole,
      organizationId: input.organizationId,
    });

    logger.info('User registered', { userId: user.id, email: user.email, role: user.role });
    return user;
  }

  // ── Login ──────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<AuthTokenPair> {
    // Use queryAsync on Postgres to bypass the Atomics spin-loop
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

    if (!user) throw new Error('Invalid email or password');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('Invalid email or password');

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

  verifyToken(token: string): {
    userId: string;
    email: string;
    role: string;
    organizationId: string;
  } {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      return {
        userId:         decoded.userId,
        email:          decoded.email,
        role:           decoded.role,
        organizationId: decoded.organizationId,
      };
    } catch {
      throw new Error('Invalid or expired token');
    }
  }

  getUserById(userId: string): Omit<User, 'passwordHash'> | null {
    // Use queryAsync on Postgres to bypass the Atomics spin-loop
    // Note: this is called from a sync context in some places, so we return
    // the result synchronously where possible and async where needed.
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

  // ── Private ──────────────────────────────────────────────────────────────

  private issueTokenPair(user: User, existingFamily?: string): AuthTokenPair {
    const family = existingFamily ?? uuidv4();

    const accessToken = jwt.sign(
      {
        userId:         user.id,
        email:          user.email,
        role:           user.role,
        organizationId: user.organizationId,
      },
      config.jwtSecret as string,
      { expiresIn: config.jwtAccessExpiresIn as any }
    );

    const rawRefresh = uuidv4() + '-' + uuidv4();
    const expiresAt = new Date();
    const days = parseInt(config.jwtRefreshExpiresIn.replace('d', ''), 10) || 7;
    expiresAt.setDate(expiresAt.getDate() + days);

    this.refreshTokenRepo.create(user.id, rawRefresh, family, expiresAt);

    const { passwordHash, ...userSafe } = user;
    void passwordHash;
    return { accessToken, refreshToken: rawRefresh, user: userSafe };
  }
}
