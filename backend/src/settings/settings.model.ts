import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class SiteSettings {
  @Field({ nullable: true })
  chatProvider?: string;

  @Field({ nullable: true })
  chatApiUrl?: string;

  @Field({ nullable: true })
  chatApiKey?: string;

  @Field({ nullable: true })
  chatModel?: string;

  @Field({ nullable: true })
  audioProvider?: string;

  @Field({ nullable: true })
  audioApiUrl?: string;

  @Field({ nullable: true })
  audioApiKey?: string;

  @Field({ nullable: true })
  audioModel?: string;

  @Field({ nullable: true })
  videoProvider?: string;

  @Field({ nullable: true })
  videoApiUrl?: string;

  @Field({ nullable: true })
  videoApiKey?: string;

  @Field({ nullable: true })
  videoModel?: string;

  @Field({ nullable: true })
  customVideoEngines?: string;
}
