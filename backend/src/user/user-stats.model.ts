import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class UserStatsModel {
  @Field(() => Int)
  totalOrders: number;

  @Field(() => Int)
  totalVideosGenerated: number;

  @Field(() => Int)
  totalInfluencersHired: number;
}
