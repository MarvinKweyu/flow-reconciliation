import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { InvoicesService } from './invoices.service';
import { Invoice, PaginatedInvoices } from './entities/invoice.entity';
import { CreateInvoiceInput } from './dto/create-invoice.input';
import {
  InvoiceFiltersInput,
  PaginationInput,
} from './dto/invoice-filters.input';

@Resolver(() => Invoice)
export class InvoicesResolver {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Query(() => PaginatedInvoices)
  async invoices(
    @Args('tenantId', { type: () => Int }) tenantId: number,
    @Args('filters', { type: () => InvoiceFiltersInput, nullable: true })
    filters?: InvoiceFiltersInput,
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
  ): Promise<PaginatedInvoices> {
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 20;
    return this.invoicesService.findAllPaginated(
      tenantId,
      filters ?? {},
      page,
      pageSize,
    ) as Promise<PaginatedInvoices>;
  }

  @Mutation(() => Invoice)
  async createInvoice(
    @Args('tenantId', { type: () => Int }) tenantId: number,
    @Args('input') input: CreateInvoiceInput,
  ): Promise<Invoice> {
    const result = await this.invoicesService.create(tenantId, input);
    return result as Invoice;
  }

  @Mutation(() => Invoice)
  async deleteInvoice(
    @Args('tenantId', { type: () => Int }) tenantId: number,
    @Args('invoiceId', { type: () => Int }) invoiceId: number,
  ): Promise<Invoice> {
    const result = await this.invoicesService.delete(tenantId, invoiceId);
    return result as Invoice;
  }
}
