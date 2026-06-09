import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { UserModel } from '../user/user.model';

@ObjectType()
export class ReviewModel {
  @Field(() => ID)
  id: string;

  @Field()
  orderId: string;

  @Field()
  customerId: string;

  @Field()
  influencerId: string;

  @Field(() => Float)
  rating: number;

  @Field({ nullable: true })
  comment?: string;

  @Field()
  createdAt: Date;

  @Field(() => UserModel, { nullable: true })
  customer?: UserModel;
}
