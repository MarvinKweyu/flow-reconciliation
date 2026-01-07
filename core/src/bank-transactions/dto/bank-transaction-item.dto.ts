import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';

export class BankTransactionItemDto {
  @ApiProperty({
    description: 'The external ID of the bank transaction',
    example: 'ext-12345',
  })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiProperty({
    description: 'The date when the bank transaction was posted',
    example: '2023-01-01',
  })
  @IsNotEmpty()
  @IsDateString()
  postedAt!: string;

  @ApiProperty({
    description: 'The amount of the bank transaction',
    example: '100.00',
  })
  @IsNotEmpty()
  @IsString()
  amount!: string;

  @ApiProperty({
    description: 'The currency of the bank transaction',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'The description of the bank transaction',
    example: 'Payment for invoic 1234',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
