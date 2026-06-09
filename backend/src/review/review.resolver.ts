import { Resolver, Query, Mutation, Args, Float } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ReviewService } from './review.service';
import { ReviewModel } from './review.model';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Resolver(() => ReviewModel)
export class ReviewResolver {
  constructor(private reviewService: ReviewService) {}

  @Mutation(() => ReviewModel)
  @UseGuards(JwtAuthGuard)
  async createReview(
    @CurrentUser() user: any,
    @Args('orderId') orderId: string,
    @Args('rating', { type: () => Float }) rating: number,
    @Args('comment', { nullable: true }) comment?: string,
  ) {
    return this.reviewService.create(user.id, orderId, rating, comment);
  }

  @Query(() => [ReviewModel])
  async influencerReviews(@Args('influencerId') influencerId: string) {
    return this.reviewService.findByInfluencer(influencerId);
  }
}
