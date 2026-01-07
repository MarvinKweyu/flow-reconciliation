import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiConfigService {
  constructor(private readonly config: ConfigService) {}

  get model(): string {
    return this.config.get<string>('AI_MODEL') ?? 'GPT-5.1-Codex-Max';
  }
}
