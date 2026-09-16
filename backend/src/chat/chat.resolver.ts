import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatModel, MessageModel, ChatNoteModel } from './chat.model';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Resolver(() => ChatModel)
export class ChatResolver {
  constructor(private chatService: ChatService) {}

  @Mutation(() => ChatModel)
  @UseGuards(JwtAuthGuard)
  async startChat(
    @CurrentUser() user: any,
    @Args('influencerId') influencerId: string,
  ) {
    return this.chatService.findOrCreateChat(user.id, influencerId);
  }

  @Query(() => [ChatModel])
  @UseGuards(JwtAuthGuard)
  async myChats(@CurrentUser() user: any) {
    return this.chatService.getUserChats(user.id);
  }

  @Query(() => ChatModel)
  @UseGuards(JwtAuthGuard)
  async chat(
    @CurrentUser() user: any,
    @Args('influencerId') influencerId: string,
  ) {
    return this.chatService.findOrCreateChat(user.id, influencerId);
  }

  @Query(() => [ChatNoteModel])
  @UseGuards(JwtAuthGuard)
  async chatNotes(
    @CurrentUser() user: any,
    @Args('chatId') chatId: string,
  ) {
    return this.chatService.getChatNotes(chatId, user.id);
  }

  @Mutation(() => ChatNoteModel)
  @UseGuards(JwtAuthGuard)
  async createChatNote(
    @CurrentUser() user: any,
    @Args('chatId') chatId: string,
    @Args('content') content: string,
    @Args('title', { nullable: true }) title?: string,
  ) {
    return this.chatService.createChatNote(chatId, user.id, content, title);
  }

  @Mutation(() => ChatNoteModel)
  @UseGuards(JwtAuthGuard)
  async updateChatNote(
    @CurrentUser() user: any,
    @Args('noteId') noteId: string,
    @Args('content') content: string,
    @Args('title', { nullable: true }) title?: string,
  ) {
    return this.chatService.updateChatNote(noteId, user.id, content, title);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteChatNote(
    @CurrentUser() user: any,
    @Args('noteId') noteId: string,
  ) {
    return this.chatService.deleteChatNote(noteId, user.id);
  }

  @Query(() => [ChatModel])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async influencerChats(@Args('influencerId') influencerId: string) {
    return this.chatService.getInfluencerChats(influencerId);
  }

  @Query(() => [ChatModel])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async allChats() {
    return this.chatService.getAllChats();
  }

  @Query(() => ChatModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminGetChat(@Args('chatId') chatId: string) {
    return this.chatService.getChatById(chatId);
  }

  @Mutation(() => MessageModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminSendMessage(
    @Args('chatId') chatId: string,
    @Args('content') content: string,
  ) {
    return this.chatService.addMessage(chatId, 'ASSISTANT', content);
  }
}
