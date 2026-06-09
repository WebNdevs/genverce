import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { ChatResolver } from './chat.resolver';
import { ChatGateway } from './chat.gateway';
import { PosterSchedulerService } from './poster-scheduler.service';
import { NotificationModule } from '../notification/notification.module';
import { AiModule } from '../ai/ai.module';
import { FaqModule } from '../faq/faq.module';

@Module({
  imports: [JwtModule.register({}), NotificationModule, AiModule, FaqModule],
  providers: [ChatService, ChatResolver, ChatGateway, PosterSchedulerService],
  exports: [ChatService],
})
export class ChatModule {}
