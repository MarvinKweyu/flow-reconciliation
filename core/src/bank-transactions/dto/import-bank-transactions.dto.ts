import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BankTransactionItemDto } from './bank-transaction-item.dto';
import { ApiProperty } from '@nestjs/swagger';

export class ImportBankTransactionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankTransactionItemDto)
  @ApiProperty({ type: [BankTransactionItemDto] })
  transactions!: BankTransactionItemDto[];
}
