import { Module, forwardRef } from '@nestjs/common';
import { UserService } from './user.service';
import { UserResolver } from './user.resolver';
import { ChatModule } from '../chat/chat.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [forwardRef(() => ChatModule), NotificationModule],
  providers: [UserService, UserResolver],
  exports: [UserService],
})
export class UserModule {}
