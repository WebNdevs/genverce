import { ObjectType, Field } from '@nestjs/graphql';
import { UserModel } from '../../user/user.model';

@ObjectType()
export class AuthResponse {
  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;

  @Field(() => UserModel)
  user: UserModel;
}
