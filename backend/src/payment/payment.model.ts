import { ObjectType, Field, ID, Float, registerEnumType } from '@nestjs/graphql';
import { PaymentStatus } from '@prisma/client';

registerEnumType(PaymentStatus, { name: 'PaymentStatus' });

@ObjectType()
export class PaymentModel {
  @Field(() => ID)
  id: string;

  @Field()
  orderId: string;

  @Field()
  customerId: string;

  @Field({ nullable: true })
  stripePaymentId?: string;

  @Field(() => Float)
  amount: number;

  @Field()
  currency: string;

  @Field(() => PaymentStatus)
  status: PaymentStatus;

  @Field(() => Float)
  refundedAmount: number;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class CheckoutSessionResponse {
  @Field()
  sessionId: string;

  @Field()
  url: string;
}
