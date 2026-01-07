import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MatchesService } from './matches.service';
import { MatchesResolver } from './matches.resolver';
import { MatchesController } from './matches.controller';
import { DatabaseModule } from '../db/database.module';
import { AiModule } from '../ai/ai.module';
import { PythonReconciliationService } from '../reconciliation/python-reconciliation.service';

@Module({
  imports: [DatabaseModule, AiModule, HttpModule],
  providers: [MatchesService, MatchesResolver, PythonReconciliationService],
  controllers: [MatchesController],
  exports: [MatchesService],
})
export class MatchesModule {}
