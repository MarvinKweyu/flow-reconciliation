import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum MatchStatus {
  PROPOSED = 'proposed',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}

registerEnumType(MatchStatus, {
  name: 'MatchStatus',
});

@ObjectType()
export class Match {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  tenantId!: number;

  @Field(() => Int)
  invoiceId!: number;

  @Field(() => Int)
  bankTransactionId!: number;

  @Field(() => String, { nullable: true })
  score?: string | null;

  @Field(() => MatchStatus)
  status!: MatchStatus;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class MatchCandidate {
  @Field(() => Int)
  invoiceId!: number;

  @Field(() => Int)
  bankTransactionId!: number;

  @Field()
  score!: number;

  @Field()
  invoiceAmount!: string;

  @Field()
  transactionAmount!: string;

  @Field({ nullable: true })
  invoiceDate?: Date;

  @Field()
  transactionDate!: Date;

  @Field({ nullable: true })
  reason?: string;
}

@ObjectType()
export class ReconciliationExplanation {
  @Field(() => Int)
  invoiceId!: number;

  @Field(() => Int)
  transactionId!: number;

  @Field()
  score!: number;

  @Field(() => [String])
  factors!: string[];

  @Field()
  recommendation!: string;
}

@ObjectType()
export class ReconciliationResult {
  @Field(() => Int)
  matchesCreated!: number;

  @Field(() => [Match])
  matches!: Match[];
}
