import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationModel } from './notification.model';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Resolver(() => NotificationModel)
export class NotificationResolver {
  constructor(private notificationService: NotificationService) {}

  @Query(() => [NotificationModel])
  @UseGuards(JwtAuthGuard)
  async myNotifications(@CurrentUser() user: any) {
    return this.notificationService.findAllForUser(user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async markNotificationRead(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ) {
    await this.notificationService.markRead(id, user.id);
    return true;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async markAllNotificationsRead(@CurrentUser() user: any) {
    return this.notificationService.markAllRead(user.id);
  }
}
