import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsResolver } from './tenants.resolver';
import { TenantsController } from './tenants.controller';
import { DatabaseModule } from '../db/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [TenantsService, TenantsResolver],
  controllers: [TenantsController],
})
export class TenantsModule {}
