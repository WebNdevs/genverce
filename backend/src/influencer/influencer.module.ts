import { Module } from '@nestjs/common';
import { InfluencerService } from './influencer.service';
import { InfluencerResolver } from './influencer.resolver';

@Module({
  providers: [InfluencerService, InfluencerResolver],
  exports: [InfluencerService],
})
export class InfluencerModule {}
