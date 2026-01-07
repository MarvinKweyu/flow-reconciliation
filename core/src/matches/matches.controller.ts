import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Tenants')
@Controller('tenants/:tenantId')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post('reconcile')
  async reconcile(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body()
    body?: {
      minScore?: number;
      invoiceIds?: number[];
      transactionIds?: number[];
    },
  ) {
    const candidates = await this.matchesService.findCandidates(tenantId, {
      minScore: body?.minScore ?? 0.7,
    });

    // Optionally filter by specific invoice/transaction IDs
    let filtered = candidates;
    if (body?.invoiceIds || body?.transactionIds) {
      filtered = candidates.filter(
        (c) =>
          (!body.invoiceIds || body.invoiceIds.includes(c.invoiceId)) &&
          (!body.transactionIds ||
            body.transactionIds.includes(c.bankTransactionId)),
      );
    }

    // Design: Return best candidates grouped per invoice
    // Each invoice gets its best N matches (default: top 3)
    const candidatesPerInvoice = new Map<number, (typeof candidates)[0][]>();
    for (const candidate of filtered) {
      if (!candidatesPerInvoice.has(candidate.invoiceId)) {
        candidatesPerInvoice.set(candidate.invoiceId, []);
      }
      candidatesPerInvoice.get(candidate.invoiceId)!.push(candidate);
    }

    const topCandidates: any[] = [];
    for (const [invoiceId, cands] of candidatesPerInvoice.entries()) {
      // Keep top 3 by score for each invoice
      topCandidates.push(
        ...cands.sort((a, b) => b.score - a.score).slice(0, 3),
      );
    }

    return {
      total: filtered.length,
      topCandidates,
      summary: {
        invoicesWithMatches: candidatesPerInvoice.size,
        totalCandidates: filtered.length,
      },
    };
  }

  @Get('reconcile/explain')
  async explainReconciliation(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Query('invoiceId', ParseIntPipe) invoiceId: number,
    @Query('transactionId', ParseIntPipe) transactionId: number,
  ) {
    return this.matchesService.explainWithAiFallback(
      tenantId,
      invoiceId,
      transactionId,
    );
  }

  @Post('matches/:matchId/confirm')
  async confirmMatch(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('matchId', ParseIntPipe) matchId: number,
  ) {
    return this.matchesService.confirmMatch(tenantId, matchId);
  }
}
