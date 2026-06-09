import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class SiteSettings {
  @Field({ nullable: true })
  chatApiUrl?: string;

  @Field({ nullable: true })
  chatApiKey?: string;

  @Field({ nullable: true })
  chatModel?: string;
}
