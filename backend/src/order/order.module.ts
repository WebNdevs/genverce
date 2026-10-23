import { Module, forwardRef } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderResolver } from './order.resolver';
import { NotificationModule } from '../notification/notification.module';
import { AiModule } from '../ai/ai.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [NotificationModule, AiModule, forwardRef(() => ChatModule)],
  providers: [OrderService, OrderResolver],
  exports: [OrderService],
})
export class OrderModule {}
