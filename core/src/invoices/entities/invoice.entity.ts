import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum InvoiceStatus {
  OPEN = 'open',
  MATCHED = 'matched',
  PAID = 'paid',
}

registerEnumType(InvoiceStatus, {
  name: 'InvoiceStatus',
});

@ObjectType()
export class Invoice {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  tenantId!: number;

  @Field(() => Int, { nullable: true })
  vendorId?: number | null;

  //   @Field({ nullable: true })
  @Field(() => String, { nullable: true })
  invoiceNumber?: string | null;

  @Field()
  amount!: string;

  @Field()
  currency!: string;

  @Field(() => Date, { nullable: true })
  invoiceDate?: Date | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => InvoiceStatus)
  status!: InvoiceStatus;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class PaginatedInvoices {
  @Field(() => [Invoice])
  items!: Invoice[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;
}
