import {
  IsOptional,
  IsEnum,
  IsNumber,
  IsString,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus } from './create-invoice.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListInvoicesDto {
  @ApiPropertyOptional({
    description: 'The status of the invoice',
    example: InvoiceStatus.OPEN,
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    description: 'The ID of the vendor',
    example: 123,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  vendorId?: number;

  @ApiPropertyOptional({
    description: 'The start date for filtering invoices',
    example: '2023-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'The end date for filtering invoices',
    example: '2023-12-31',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'The minimum amount for filtering invoices',
    example: '100.00',
  })
  @IsOptional()
  @IsString()
  amountMin?: string;

  @ApiPropertyOptional({
    description: 'The maximum amount for filtering invoices',
    example: '1000.00',
  })
  @IsOptional()
  @IsString()
  amountMax?: string;
}
