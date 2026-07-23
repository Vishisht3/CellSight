import { v4 as uuidv4 } from 'uuid';
import type { DbDriver } from '../driver';
import crypto from 'crypto';

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  family: string;
  expiresAt: string;
  revoked: number;
  createdAt: string;
}

export class RefreshTokenRepository {
  constructor(private db: DbDriver) {}

  /** Hash a raw token before storing — never persist plaintext tokens */
  static hash(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  create(userId: string, rawToken: string, family: string, expiresAt: Date): RefreshTokenRecord {
    const now = new Date().toISOString();
    const record: RefreshTokenRecord = {
      id: uuidv4(),
      userId,
      tokenHash: RefreshTokenRepository.hash(rawToken),
      family,
      expiresAt: expiresAt.toISOString(),
      revoked: 0,
      createdAt: now,
    };

    this.db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, family, expires_at, revoked, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(record.id, record.userId, record.tokenHash, record.family, record.expiresAt, record.revoked, record.createdAt);

    return record;
  }

  findByTokenHash(rawToken: string): RefreshTokenRecord | null {
    const hash = RefreshTokenRepository.hash(rawToken);
    return (this.db.prepare(`
      SELECT id, user_id as userId, token_hash as tokenHash, family,
             expires_at as expiresAt, revoked, created_at as createdAt
      FROM refresh_tokens WHERE token_hash = ?
    `).get(hash) as RefreshTokenRecord | undefined) ?? null;
  }

  /** Revoke every token in a family (detect reuse attack) */
  revokeFamily(family: string): void {
    this.db.prepare(`UPDATE refresh_tokens SET revoked = 1 WHERE family = ?`).run(family);
  }

  revokeOne(id: string): void {
    this.db.prepare(`UPDATE refresh_tokens SET revoked = 1 WHERE id = ?`).run(id);
  }

  revokeAllForUser(userId: string): void {
    this.db.prepare(`UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?`).run(userId);
  }

  deleteExpired(): void {
    this.db.prepare(`DELETE FROM refresh_tokens WHERE expires_at < ?`).run(new Date().toISOString());
  }
}
