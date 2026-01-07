import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DRIZZLE, PG_POOL } from './tokens';

@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        if (!url) return null;
        return new Pool({ connectionString: url });
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool | null) => {
        if (!pool) return null;
        return drizzle(pool);
      },
    },
  ],
  exports: [PG_POOL, DRIZZLE],
})
export class DatabaseModule {}
