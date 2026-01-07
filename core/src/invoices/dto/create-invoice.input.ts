import { Field, InputType, Int } from '@nestjs/graphql';
import { InvoiceStatus } from '../entities/invoice.entity';

@InputType()
export class CreateInvoiceInput {
  @Field(() => Int, { nullable: true })
  vendorId?: number;

  @Field({ nullable: true })
  vendorName?: string;

  @Field({ nullable: true })
  invoiceNumber?: string;

  @Field()
  amount!: string;

  @Field({ nullable: true })
  currency?: string;

  @Field({ nullable: true })
  invoiceDate?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => InvoiceStatus, { nullable: true })
  status?: InvoiceStatus;
}
