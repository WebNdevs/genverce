import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { TicketStatus } from '@prisma/client';
import { OrderModel } from '../order/order.model';
import { UserModel } from '../user/user.model';

registerEnumType(TicketStatus, { name: 'TicketStatus' });

@ObjectType()
export class TicketModel {
  @Field(() => ID)
  id: string;

  @Field()
  customerId: string;

  @Field({ nullable: true })
  orderId?: string;

  @Field()
  issue: string;

  @Field(() => TicketStatus)
  status: TicketStatus;

  @Field({ nullable: true })
  resolution?: string;

  @Field({ nullable: true })
  reopenNote?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => OrderModel, { nullable: true })
  order?: OrderModel;

  @Field(() => UserModel, { nullable: true })
  customer?: UserModel;
}
