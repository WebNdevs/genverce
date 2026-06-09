import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class NotificationModel {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  href: string;

  @Field()
  read: boolean;

  @Field()
  createdAt: Date;
}
