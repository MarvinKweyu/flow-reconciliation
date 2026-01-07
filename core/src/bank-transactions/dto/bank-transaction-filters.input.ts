import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';

@InputType()
export class BankTransactionFiltersInput {
  @ApiProperty({
    description: 'The date from which the bank transaction was posted',
    example: '2023-01-01',
  })
  @Field({ nullable: true })
  dateFrom?: string;

  @ApiProperty({
    description: 'The date to which the bank transaction was posted',
    example: '2023-12-31',
  })
  @Field({ nullable: true })
  dateTo?: string;

  @ApiProperty({
    description: 'The minimum amount of the bank transaction',
    example: '50.00',
  })
  @Field({ nullable: true })
  amountMin?: string;

  @ApiProperty({
    description: 'The maximum amount of the bank transaction',
    example: '100.00',
  })
  @Field({ nullable: true })
  amountMax?: string;
  @ApiProperty({
    description: 'The description of the bank transaction',
    example: 'Payment for invoice #1234',
  })
  @Field({ nullable: true })
  description?: string;
}
