import { Field, InputType, ObjectType, ID } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';

@ObjectType('StandaloneVideo')
export class StandaloneVideoModel {
  @Field(() => ID)
  id: string;

  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => String)
  prompt: string;

  @Field(() => String)
  videoUrl: string;

  @Field(() => String, { nullable: true })
  thumbnailUrl?: string;

  @Field(() => String, { nullable: true })
  provider?: string;

  @Field(() => String, { nullable: true })
  model?: string;

  @Field(() => String, { nullable: true })
  duration?: string;

  @Field(() => String, { nullable: true })
  aspectRatio?: string;

  @Field(() => String)
  status: string;

  @Field(() => GraphQLJSONObject, { nullable: true })
  metadata?: any;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@InputType()
export class AdminGenerateStandaloneVideoInput {
  @Field(() => String)
  prompt: string;

  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => String, { nullable: true })
  duration?: string;

  @Field(() => String, { nullable: true })
  aspectRatio?: string;

  @Field(() => String, { nullable: true })
  videoProvider?: string;

  @Field(() => String, { nullable: true })
  videoModel?: string;
}
