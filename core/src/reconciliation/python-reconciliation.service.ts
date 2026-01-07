import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface ReconciliationInput {
  invoice: {
    id: number;
    amount: string;
    currency: string;
    date?: string;
    description?: string;
  };
  transaction: {
    id: number;
    amount: string;
    currency: string;
    date: string;
    description?: string;
  };
}

export interface ReconciliationMatch {
  invoiceId: number;
  transactionId: number;
  score: number;
  factors: string[];
  recommendation: string;
}

@Injectable()
export class PythonReconciliationService {
  private readonly logger = new Logger(PythonReconciliationService.name);
  private readonly pythonServiceUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.pythonServiceUrl =
      this.config.get<string>('RECONCILIATION_URL') ||
      'http://reconciliation:8000/graphql';
  }

  /**
   * Call Python GraphQL reconciliation service for deterministic explanation
   * GraphQL query: matchCandidates(tenantId, invoices, bankTransactions, minScore)
   */
  async explainViaPython(
    tenantId: number,
    invoiceData: {
      id: number;
      amount: string;
      currency: string;
      date?: string;
      description?: string | null | undefined;
    },
    transactionData: {
      id: number;
      amount: string;
      currency: string;
      date: string;
      description?: string | null | undefined;
    },
  ): Promise<{ score: number; factors: string[]; explanation: string } | null> {
    try {
      const query = `
        query {
          matchCandidates(
            tenantId: ${tenantId}
            invoices: [
              {
                id: ${invoiceData.id}
                amount: "${invoiceData.amount}"
                currency: "${invoiceData.currency}"
                date: ${invoiceData.date ? `"${invoiceData.date}"` : 'null'}
                description: ${invoiceData.description ? `"${invoiceData.description}"` : 'null'}
              }
            ]
            bankTransactions: [
              {
                id: ${transactionData.id}
                amount: "${transactionData.amount}"
                currency: "${transactionData.currency}"
                postedAt: "${transactionData.date}"
                description: ${transactionData.description ? `"${transactionData.description}"` : 'null'}
              }
            ]
            minScore: 0.0
          ) {
            invoiceId
            transactionId
            score
            factors
            recommendation
          }
        }
      `;

      this.logger.debug(
        `Calling Python reconciliation service at ${this.pythonServiceUrl}`,
      );

      const response: any = await firstValueFrom(
        this.http.post(`${this.pythonServiceUrl}/graphql`, { query }),
      );

      if (
        response.data?.data?.matchCandidates &&
        response.data.data.matchCandidates.length > 0
      ) {
        const match = response.data.data.matchCandidates[0];
        this.logger.debug(
          `Python service returned match score: ${match.score}`,
        );

        const explanation = `
Score: ${(match.score * 100).toFixed(1)}%
Recommendation: ${match.recommendation}
Factors: ${match.factors?.join(', ') || 'None'}
        `.trim();

        return {
          score: match.score,
          factors: match.factors || [],
          explanation,
        };
      }

      this.logger.warn('Python service returned no match candidates');
      return null;
    } catch (error) {
      this.logger.error(
        `Python reconciliation service error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
