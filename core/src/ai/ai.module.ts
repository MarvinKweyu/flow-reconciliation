import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiConfigService } from './ai-config.service';
import { AiExplanationService } from './ai-explanation.service';

@Module({
  imports: [HttpModule],
  providers: [AiConfigService, AiExplanationService],
  exports: [AiConfigService, AiExplanationService, HttpModule],
})
export class AiModule {}
