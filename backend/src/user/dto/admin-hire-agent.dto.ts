import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class AdminHireAgentResult {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field(() => String, { nullable: true })
  orderId?: string;

  @Field()
  userId: string;

  @Field()
  influencerId: string;

  @Field()
  influencerName: string;

  @Field(() => String, { nullable: true })
  userName?: string;

  @Field(() => Boolean, { nullable: true })
  alreadyHired?: boolean;
}

@ObjectType()
export class HiredAgentInfo {
  @Field()
  influencerId: string;

  @Field()
  influencerName: string;

  @Field(() => String, { nullable: true })
  avatar?: string;

  @Field(() => String, { nullable: true })
  serviceType?: string;

  @Field()
  orderId: string;

  @Field()
  status: string;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class UserHiredAgentOverview {
  @Field()
  influencerId: string;

  @Field()
  influencerName: string;

  @Field(() => String, { nullable: true })
  avatar?: string;

  @Field(() => String, { nullable: true })
  serviceType?: string;

  @Field(() => String, { nullable: true })
  bio?: string;

  @Field()
  orderId: string;

  @Field()
  status: string;

  @Field(() => Number)
  totalOrders: number;

  @Field(() => Number)
  completedOrders: number;

  @Field(() => Number)
  pendingOrders: number;

  @Field(() => Number)
  remainingOrders: number;

  @Field(() => Number)
  totalOrderedUnits: number;

  @Field(() => Number)
  totalDeliveredUnits: number;

  @Field(() => Number)
  remainingUnits: number;

  @Field(() => String, { nullable: true })
  chatId?: string;

  @Field(() => Date, { nullable: true })
  latestOrderDate?: Date;
}

@ObjectType()
export class UserHiredAgentsSummary {
  @Field(() => Number)
  totalAgents: number;

  @Field(() => Number)
  activeAgents: number;

  @Field(() => Number)
  totalRemainingOrders: number;

  @Field(() => Number)
  totalCompletedOrders: number;

  @Field(() => Number)
  totalPendingOrders: number;

  @Field(() => [UserHiredAgentOverview])
  agents: UserHiredAgentOverview[];
}

