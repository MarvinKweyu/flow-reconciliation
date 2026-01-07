import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { BankTransactionsService } from './bank-transactions.service';
import {
  BankTransaction,
  PaginatedBankTransactions,
  ImportResult,
} from './entities/bank-transaction.entity';
import { BankTransactionFiltersInput } from './dto/bank-transaction-filters.input';
import { ImportBankTransactionsInput } from './dto/bank-transaction.input';
import { PaginationInput } from '../invoices/dto/invoice-filters.input';

@Resolver(() => BankTransaction)
export class BankTransactionsResolver {
  constructor(
    private readonly bankTransactionsService: BankTransactionsService,
  ) {}

  @Query(() => PaginatedBankTransactions)
  async bankTransactions(
    @Args('tenantId', { type: () => Int }) tenantId: number,
    @Args('filters', {
      type: () => BankTransactionFiltersInput,
      nullable: true,
    })
    filters?: BankTransactionFiltersInput,
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
  ): Promise<PaginatedBankTransactions> {
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 20;
    return this.bankTransactionsService.findAllPaginated(
      tenantId,
      filters ?? {},
      page,
      pageSize,
    );
  }

  @Mutation(() => ImportResult)
  async importBankTransactions(
    @Args('tenantId', { type: () => Int }) tenantId: number,
    @Args('input') input: ImportBankTransactionsInput,
    @Args('idempotencyKey', { nullable: true }) idempotencyKey?: string,
  ): Promise<ImportResult> {
    // track idempotencyKey via externalId per transaction
    return this.bankTransactionsService.bulkImport(
      tenantId,
      input.transactions,
    );
  }
}
