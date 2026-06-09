import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketModel } from './ticket.model';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, TicketStatus } from '@prisma/client';

@Resolver(() => TicketModel)
export class TicketResolver {
  constructor(private ticketService: TicketService) {}

  @Mutation(() => TicketModel)
  @UseGuards(JwtAuthGuard)
  async createTicket(
    @CurrentUser() user: any,
    @Args('issue') issue: string,
    @Args('orderId', { nullable: true }) orderId?: string,
  ) {
    return this.ticketService.create(user.id, orderId, issue);
  }

  @Query(() => [TicketModel])
  @UseGuards(JwtAuthGuard)
  async myTickets(@CurrentUser() user: any) {
    return this.ticketService.findByCustomer(user.id);
  }

  @Query(() => [TicketModel])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async allTickets(
    @Args('status', { type: () => TicketStatus, nullable: true }) status?: TicketStatus,
  ) {
    return this.ticketService.findAll(status);
  }

  @Mutation(() => TicketModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async resolveTicket(
    @Args('id') id: string,
    @Args('resolution') resolution: string,
  ) {
    return this.ticketService.resolve(id, resolution);
  }

  @Mutation(() => TicketModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateTicketStatus(
    @Args('id') id: string,
    @Args('status', { type: () => TicketStatus }) status: TicketStatus,
  ) {
    return this.ticketService.updateStatus(id, status);
  }

  @Mutation(() => TicketModel)
  @UseGuards(JwtAuthGuard)
  async reopenTicket(
    @CurrentUser() user: any,
    @Args('id') id: string,
    @Args('note') note: string,
  ) {
    return this.ticketService.reopen(id, user.id, note);
  }
}
