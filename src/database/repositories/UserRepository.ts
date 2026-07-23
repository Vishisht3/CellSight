import { Database } from '../sqlite-shim';
import { v4 as uuidv4 } from 'uuid';
import { User, UserCreateInput } from '../../models/types';
import { UserRole } from '../../config/constants';

export class UserRepository {
  constructor(private db: Database) {}

  create(input: UserCreateInput & { passwordHash: string }): User {
    const now = new Date().toISOString();
    const user: User = {
      id: uuidv4(),
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role,
      name: input.name,
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, password_hash, role, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      user.id,
      user.email,
      user.passwordHash,
      user.role,
      user.name,
      user.createdAt,
      user.updatedAt
    );

    return user;
  }

  findByEmail(email: string): User | null {
    const stmt = this.db.prepare(`
      SELECT 
        id, email, password_hash as passwordHash, role, name, 
        created_at as createdAt, updated_at as updatedAt
      FROM users 
      WHERE email = ?
    `);

    return stmt.get(email) as User | undefined || null;
  }

  findById(id: string): User | null {
    const stmt = this.db.prepare(`
      SELECT 
        id, email, password_hash as passwordHash, role, name, 
        created_at as createdAt, updated_at as updatedAt
      FROM users 
      WHERE id = ?
    `);

    return stmt.get(id) as User | undefined || null;
  }

  list(): User[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, email, password_hash as passwordHash, role, name, 
        created_at as createdAt, updated_at as updatedAt
      FROM users 
      ORDER BY created_at DESC
    `);

    return stmt.all() as User[];
  }

  updateRole(id: string, role: UserRole): boolean {
    const stmt = this.db.prepare(`
      UPDATE users 
      SET role = ?, updated_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(role, new Date().toISOString(), id);
    return result.changes > 0;
  }
}
