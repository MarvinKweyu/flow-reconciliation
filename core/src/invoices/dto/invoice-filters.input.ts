import { Field, InputType, Int } from '@nestjs/graphql';
import { InvoiceStatus } from '../entities/invoice.entity';

@InputType()
export class InvoiceFiltersInput {
  @Field(() => InvoiceStatus, { nullable: true })
  status?: InvoiceStatus;

  @Field(() => Int, { nullable: true })
  vendorId?: number;

  @Field({ nullable: true })
  dateFrom?: string;

  @Field({ nullable: true })
  dateTo?: string;

  @Field({ nullable: true })
  amountMin?: string;

  @Field({ nullable: true })
  amountMax?: string;
}

@InputType()
export class PaginationInput {
  @Field(() => Int, { defaultValue: 1 })
  page: number = 1;

  @Field(() => Int, { defaultValue: 20 })
  pageSize: number = 20;
}
