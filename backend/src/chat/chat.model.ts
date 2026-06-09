import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { MessageRole } from '@prisma/client';
import { InfluencerModel } from '../influencer/influencer.model';
import { UserModel } from '../user/user.model';

registerEnumType(MessageRole, { name: 'MessageRole' });

@ObjectType()
export class MessageModel {
  @Field(() => ID)
  id: string;

  @Field()
  chatId: string;

  @Field(() => MessageRole)
  role: MessageRole;

  @Field()
  content: string;

  @Field({ nullable: true })
  imageUrl?: string;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class ChatModel {
  @Field(() => ID)
  id: string;

  @Field()
  customerId: string;

  @Field()
  influencerId: string;

  @Field(() => [MessageModel])
  messages: MessageModel[];

  @Field(() => InfluencerModel, { nullable: true })
  influencer?: InfluencerModel;

  @Field(() => UserModel, { nullable: true })
  customer?: UserModel;

  @Field()
  createdAt: Date;
}
