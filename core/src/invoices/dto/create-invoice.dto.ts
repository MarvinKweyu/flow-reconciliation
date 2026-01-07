import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
} from 'class-validator';

export enum InvoiceStatus {
  OPEN = 'open',
  MATCHED = 'matched',
  PAID = 'paid',
}

export class CreateInvoiceDto {
  @ApiProperty({
    description: 'The ID of the vendor',
    example: 123,
  })
  @IsOptional()
  @IsNumber()
  vendorId?: number;

  @ApiPropertyOptional({
    description:
      'The name of the vendor. If provided and vendorId is not set, the vendor will be upserted (created if not exists) for this tenant.',
    example: 'Acme Corp',
  })
  @IsOptional()
  @IsString()
  vendorName?: string;

  @ApiPropertyOptional({
    description: 'The invoice number',
    example: 'INV-12345',
  })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiProperty({
    description: 'The amount of the invoice',
    example: '1500.00',
  })
  @IsNotEmpty()
  @IsString()
  amount!: string;

  @ApiPropertyOptional({
    description: 'The currency of the invoice',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'The date of the invoice',
    example: '2023-01-01',
  })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @ApiPropertyOptional({
    description: 'The description of the invoice',
    example: 'Invoice for services rendered',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'The status of the invoice',
    example: InvoiceStatus.OPEN,
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;
}
