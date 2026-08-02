import type { DbDriver } from '../driver';
import { v4 as uuidv4 } from 'uuid';
import { Organization, OrganizationCreateInput } from '../../models/types';

export class OrganizationRepository {
  constructor(private db: DbDriver) {}

  create(input: OrganizationCreateInput): Organization {
    const now = new Date().toISOString();
    const org: Organization = {
      id: uuidv4(),
      name: input.name,
      orgType: input.orgType,
      createdAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO organizations (id, name, org_type, created_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(org.id, org.name, org.orgType, org.createdAt);
    return org;
  }

  findById(id: string): Organization | null {
    const stmt = this.db.prepare(`
      SELECT id, name, org_type as orgType, created_at as createdAt
      FROM organizations
      WHERE id = ?
    `);
    return stmt.get(id) as Organization | undefined || null;
  }

  findByName(name: string): Organization | null {
    const stmt = this.db.prepare(`
      SELECT id, name, org_type as orgType, created_at as createdAt
      FROM organizations
      WHERE name = ?
    `);
    return stmt.get(name) as Organization | undefined || null;
  }

  list(): Organization[] {
    const stmt = this.db.prepare(`
      SELECT id, name, org_type as orgType, created_at as createdAt
      FROM organizations
      ORDER BY created_at DESC
    `);
    return stmt.all() as Organization[];
  }
}
