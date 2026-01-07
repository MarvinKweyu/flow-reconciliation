import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class BankTransactionInput {
  @Field({ nullable: true })
  externalId?: string;

  @Field()
  postedAt!: string;

  @Field()
  amount!: string;

  @Field({ nullable: true })
  currency?: string;

  @Field({ nullable: true })
  description?: string;
}

@InputType()
export class ImportBankTransactionsInput {
  @Field(() => [BankTransactionInput])
  transactions!: BankTransactionInput[];
}
