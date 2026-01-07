import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { MatchesService } from './matches.service';
import {
  Match,
  MatchCandidate,
  ReconciliationExplanation,
  ReconciliationResult,
} from './entities/match.entity';
import { ReconcileInput, MatchFiltersInput } from './dto/match.input';

@Resolver(() => Match)
export class MatchesResolver {
  constructor(private readonly matchesService: MatchesService) {}

  @Query(() => [MatchCandidate])
  async matchCandidates(
    @Args('tenantId', { type: () => Int }) tenantId: number,
    @Args('filters', { type: () => MatchFiltersInput, nullable: true })
    filters?: MatchFiltersInput,
  ): Promise<MatchCandidate[]> {
    const result = await this.matchesService.findCandidates(tenantId, filters ?? {});
    return result as MatchCandidate[];
  }

  @Query(() => ReconciliationExplanation)
  async explainReconciliation(
    @Args('tenantId', { type: () => Int }) tenantId: number,
    @Args('invoiceId', { type: () => Int }) invoiceId: number,
    @Args('transactionId', { type: () => Int }) transactionId: number,
  ): Promise<ReconciliationExplanation> {
    return this.matchesService.explainReconciliation(
      tenantId,
      invoiceId,
      transactionId,
    );
  }

  @Mutation(() => ReconciliationResult)
  async reconcile(
    @Args('tenantId', { type: () => Int }) tenantId: number,
    @Args('input', { type: () => ReconcileInput, nullable: true })
    input?: ReconcileInput,
  ): Promise<ReconciliationResult> {
    const result = await this.matchesService.reconcile(tenantId, input);
    return result as ReconciliationResult;
  }

  @Mutation(() => Match)
  async confirmMatch(
    @Args('tenantId', { type: () => Int }) tenantId: number,
    @Args('matchId', { type: () => Int }) matchId: number,
  ): Promise<Match> {
    const result = await this.matchesService.confirmMatch(tenantId, matchId);
    return result as Match;
  }
}
