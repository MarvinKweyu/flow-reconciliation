import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class BankTransaction {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  tenantId!: number;

  @Field(() => String, { nullable: true })
  externalId?: string | null;

  @Field(() => Date)
  postedAt!: Date;

  @Field(() => String)
  amount!: string;

  @Field(() => String)
  currency!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class PaginatedBankTransactions {
  @Field(() => [BankTransaction])
  items!: BankTransaction[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;
}

@ObjectType()
export class ImportResult {
  @Field(() => Int)
  imported!: number;

  @Field(() => Int)
  skipped!: number;

  @Field(() => [String])
  errors!: string[];
}
