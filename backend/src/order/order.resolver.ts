import { Resolver, Query, Mutation, Args, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderModel, GeneratedImageModel } from './order.model';
import { CreateOrderInput } from './dto/create-order.dto';
import { AdminCreateOrderInput } from './dto/admin-create-order.dto';
import { AdminUpdateOrderInput } from './dto/admin-update-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, OrderStatus } from '@prisma/client';

@Resolver(() => OrderModel)
export class OrderResolver {
  constructor(private orderService: OrderService) {}

  @Mutation(() => OrderModel)
  @UseGuards(JwtAuthGuard)
  async createOrder(
    @CurrentUser() user: any,
    @Args('input') input: CreateOrderInput,
  ) {
    return this.orderService.create(user.id, input);
  }

  @Query(() => OrderModel)
  @UseGuards(JwtAuthGuard)
  async order(@Args('id') id: string) {
    return this.orderService.findById(id);
  }

  @ResolveField(() => [GeneratedImageModel])
  async generatedImages(@Parent() order: OrderModel) {
    return this.orderService.findGeneratedImages(order.id);
  }

  @Query(() => [OrderModel])
  @UseGuards(JwtAuthGuard)
  async myOrders(@CurrentUser() user: any) {
    return this.orderService.findByCustomer(user.id);
  }

  @Query(() => [OrderModel])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async allOrders(
    @Args('status', { type: () => OrderStatus, nullable: true }) status?: OrderStatus,
  ) {
    return this.orderService.findAll(status);
  }

  @Query(() => [OrderModel])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER)
  async pendingReviewOrders() {
    return this.orderService.findPendingReview();
  }

  @Mutation(() => OrderModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER)
  async approveOrder(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ) {
    return this.orderService.updateStatus(id, 'DELIVERED', undefined, user.id);
  }

  @Query(() => [OrderModel])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async influencerOrders(@Args('influencerId') influencerId: string) {
    return this.orderService.findByInfluencer(influencerId);
  }

  @Mutation(() => OrderModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminCreateOrder(@Args('input') input: AdminCreateOrderInput) {
    return this.orderService.adminCreate(input);
  }

  @Mutation(() => OrderModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminUpdateOrder(@Args('input') input: AdminUpdateOrderInput) {
    return this.orderService.adminUpdate(input);
  }

  @Mutation(() => OrderModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER)
  async rejectOrder(
    @CurrentUser() user: any,
    @Args('id') id: string,
    @Args('notes') notes: string,
  ) {
    return this.orderService.updateStatus(id, 'REJECTED', notes, user.id);
  }
}
