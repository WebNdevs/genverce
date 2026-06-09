import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentModel, CheckoutSessionResponse } from './payment.model';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Resolver(() => PaymentModel)
export class PaymentResolver {
  constructor(private paymentService: PaymentService) {}

  @Mutation(() => CheckoutSessionResponse)
  @UseGuards(JwtAuthGuard)
  async createCheckoutSession(
    @CurrentUser() user: any,
    @Args('orderId') orderId: string,
  ) {
    return this.paymentService.createCheckoutSession(orderId, user.id);
  }

  @Mutation(() => PaymentModel)
  @UseGuards(JwtAuthGuard)
  async requestRefund(
    @CurrentUser() user: any,
    @Args('orderId') orderId: string,
  ) {
    return this.paymentService.processRefund(orderId, user.id);
  }
}
