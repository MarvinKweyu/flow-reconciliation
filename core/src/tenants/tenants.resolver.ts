import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { TenantsService } from './tenants.service';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantInput } from './dto/create-tenant.input';

@Resolver(() => Tenant)
export class TenantsResolver {
  constructor(private readonly tenantsService: TenantsService) {}

  @Mutation(() => Tenant)
  async createTenant(@Args('input') input: CreateTenantInput): Promise<Tenant> {
    const row = await this.tenantsService.create(input.name);
    return {
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  @Query(() => [Tenant])
  async tenants(): Promise<Tenant[]> {
    const rows = await this.tenantsService.findAll();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }
}
