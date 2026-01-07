import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class ReconcileInput {
  @Field(() => [Int], { nullable: true })
  invoiceIds?: number[];

  @Field(() => [Int], { nullable: true })
  transactionIds?: number[];

  @Field({ nullable: true, defaultValue: 0.7 })
  minScore?: number;
}

@InputType()
export class MatchFiltersInput {
  @Field(() => Int, { nullable: true })
  invoiceId?: number;

  @Field(() => Int, { nullable: true })
  bankTransactionId?: number;

  @Field({ nullable: true })
  minScore?: number;
}
