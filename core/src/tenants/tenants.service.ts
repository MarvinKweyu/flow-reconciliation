import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../db/tokens';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { tenant } from '../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class TenantsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase | null,
  ) {}

  private ensureDb() {
    if (!this.db) {
      throw new Error('Database not configured. Set DATABASE_URL.');
    }
    return this.db;
  }

  async create(name: string) {
    const db = this.ensureDb();
    const [created] = await db.insert(tenant).values({ name }).returning();
    return created;
  }

  async findAll() {
    const db = this.ensureDb();
    return db.select().from(tenant).orderBy(tenant.id);
  }

  async findOne(id: number) {
    const db = this.ensureDb();
    const [row] = await db.select().from(tenant).where(eq(tenant.id, id));
    return row ?? null;
  }
}
