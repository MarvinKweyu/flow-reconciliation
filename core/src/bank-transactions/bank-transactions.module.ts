import { Module } from '@nestjs/common';
import { BankTransactionsService } from './bank-transactions.service';
import { BankTransactionsController } from './bank-transactions.controller';
import { BankTransactionsResolver } from './bank-transactions.resolver';
import { DatabaseModule } from '../db/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [BankTransactionsService, BankTransactionsResolver],
  controllers: [BankTransactionsController],
})
export class BankTransactionsModule {}
