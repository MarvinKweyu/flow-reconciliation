import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface ExplanationRequest {
  invoice: {
    id: number;
    amount: string;
    currency: string;
    invoiceDate: Date | null;
    description?: string | null | undefined;
  };
  transaction: {
    id: number;
    amount: string;
    currency: string;
    postedAt: Date;
    description?: string | null | undefined;
  };
}

export interface ExplanationResponse {
  explanation: string;
  source: 'ai' | 'python';
  score?: number;
  factors?: string[];
}

@Injectable()
export class AiExplanationService {
  private readonly logger = new Logger(AiExplanationService.name);
  private readonly aiApiUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.aiApiUrl = this.config.get<string>('AI_API_URL') || '';
  }

  /**
   * Call external AI service to explain match reconciliation
   * @param request Invoice and transaction to explain
   * @returns AI explanation or null on error (for fallback)
   */
  async explainViaAi(request: ExplanationRequest): Promise<string | null> {
    if (!this.aiApiUrl) {
      this.logger.debug('AI_API_URL not configured, skipping AI explanation');
      return null;
    }

    try {
      const payload = {
        invoice: {
          id: request.invoice.id,
          amount: request.invoice.amount,
          currency: request.invoice.currency,
          date: request.invoice.invoiceDate?.toISOString().split('T')[0],
          description: request.invoice.description,
        },
        transaction: {
          id: request.transaction.id,
          amount: request.transaction.amount,
          currency: request.transaction.currency,
          date: request.transaction.postedAt.toISOString().split('T')[0],
          description: request.transaction.description,
        },
      };

      this.logger.debug(
        `Calling AI service at ${this.aiApiUrl} with payload:`,
        payload,
      );

      const response: any = await firstValueFrom(
        this.http.post(`${this.aiApiUrl}/explain`, payload),
      );

      if (response.data?.explanation) {
        this.logger.debug('AI service returned explanation');
        return response.data.explanation;
      }

      this.logger.warn('AI service returned no explanation in response');
      return null;
    } catch (error) {
      this.logger.warn(
        `AI explanation failed: ${error instanceof Error ? error.message : String(error)}. Will use Python fallback.`,
      );
      return null;
    }
  }
}
