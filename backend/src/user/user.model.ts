import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { Role, AccountType } from '@prisma/client';

registerEnumType(Role, { name: 'Role' });
registerEnumType(AccountType, { name: 'AccountType' });

@ObjectType()
export class UserModel {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  username?: string;

  @Field()
  email: string;

  @Field(() => Role)
  role: Role;

  @Field(() => AccountType)
  accountType: AccountType;

  @Field({ nullable: true })
  avatar?: string;

  @Field({ nullable: true })
  company?: string;

  @Field()
  isActive: boolean;

  @Field()
  isOnboarded: boolean;

  @Field({ nullable: true })
  brandName?: string;

  @Field({ nullable: true })
  productName?: string;

  @Field({ nullable: true })
  website?: string;

  @Field({ nullable: true })
  targetAudience?: string;

  @Field({ nullable: true })
  tone?: string;

  // ADD THESE 👇

  @Field({ nullable: true })
  industry?: string;

  @Field({ nullable: true })
  goal?: string;

  @Field(() => [String], { nullable: true })
  platforms?: string[];

  @Field(() => [String], { nullable: true })
  contentTypes?: string[];

  // END

  @Field()
  requestedCustomInfluencer: boolean;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date;

  @Field()
  createdAt: Date;
}
