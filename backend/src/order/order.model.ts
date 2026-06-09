import { ObjectType, Field, ID, Float, Int, registerEnumType } from '@nestjs/graphql';
import { OrderStatus, PackageType, DeliveryType } from '@prisma/client';
import { InfluencerModel } from '../influencer/influencer.model';
import { UserModel } from '../user/user.model';
import { ReviewModel } from '../review/review.model';
import { GraphQLJSONObject } from 'graphql-type-json';

registerEnumType(OrderStatus, { name: 'OrderStatus' });
registerEnumType(PackageType, { name: 'PackageType' });
registerEnumType(DeliveryType, { name: 'DeliveryType' });

@ObjectType()
export class GeneratedImageModel {
  @Field()
  url: string;

  @Field()
  messageId: string;

  @Field()
  createdAt: Date;

  @Field({ nullable: true })
  delivered?: boolean;

  @Field({ nullable: true })
  deliveredAt?: Date;
}

@ObjectType()
export class OrderModel {
  @Field(() => ID)
  id: string;

  @Field()
  customerId: string;

  @Field()
  influencerId: string;

  @Field(() => GraphQLJSONObject)
  projectBrief: any;

  @Field(() => PackageType)
  package: PackageType;

  @Field(() => DeliveryType)
  deliveryType: DeliveryType;

  @Field(() => OrderStatus)
  status: OrderStatus;

  @Field(() => Float)
  price: number;

  @Field({ nullable: true })
  videoUrl?: string;

  @Field({ nullable: true })
  thumbnailUrl?: string;

  @Field()
  aiDisclosure: boolean;

  @Field({ nullable: true })
  reviewNotes?: string;

  @Field({ nullable: true })
  reviewedBy?: string;

  @Field({ nullable: true })
  reviewedAt?: Date;

  @Field({ nullable: true })
  deliveredAt?: Date;

  @Field(() => Int)
  videosOrdered: number;

  @Field(() => Int)
  videosDelivered: number;

  @Field()
  createdAt: Date;

  @Field(() => [GeneratedImageModel], { nullable: true })
  generatedImages?: GeneratedImageModel[];

  @Field(() => InfluencerModel, { nullable: true })
  influencer?: InfluencerModel;

  @Field(() => UserModel, { nullable: true })
  customer?: UserModel;

  @Field(() => ReviewModel, { nullable: true })
  review?: ReviewModel;
}
