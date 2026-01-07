import { Controller, Post, Param, Body, ParseIntPipe } from '@nestjs/common';
import { BankTransactionsService } from './bank-transactions.service';
import { ImportBankTransactionsDto } from './dto/import-bank-transactions.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Tenants')
@Controller('tenants/:tenantId/bank-transactions')
export class BankTransactionsController {
  constructor(
    private readonly bankTransactionsService: BankTransactionsService,
  ) {}

  @Post('import')
  async import(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: ImportBankTransactionsDto,
  ) {
    return this.bankTransactionsService.bulkImport(tenantId, dto.transactions);
  }
}
