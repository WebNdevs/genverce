import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { DatabaseModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { InfluencerModule } from './influencer/influencer.module';
import { OrderModule } from './order/order.module';
import { ChatModule } from './chat/chat.module';
import { ReviewModule } from './review/review.module';
import { TicketModule } from './ticket/ticket.module';
import { PaymentModule } from './payment/payment.module';
import { AiModule } from './ai/ai.module';
import { FaqModule } from './faq/faq.module';
import { NotificationModule } from './notification/notification.module';
import { UploadModule } from './upload/upload.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/graphql/schema.gql'),
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      context: ({ req, res }: any) => ({ req, res }),
    }),
    DatabaseModule,
    AuthModule,
    UserModule,
    InfluencerModule,
    OrderModule,
    ChatModule,
    ReviewModule,
    TicketModule,
    PaymentModule,
    AiModule,
    FaqModule,
    NotificationModule,
    UploadModule,
    SettingsModule,
  ],
})
export class AppModule {}
