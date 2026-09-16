import { gql } from '@apollo/client';

export const ADMIN_SEND_MESSAGE = gql`
  mutation AdminSendMessage($chatId: String!, $content: String!) {
    adminSendMessage(chatId: $chatId, content: $content) {
      id
      chatId
      role
      content
      createdAt
    }
  }
`;

export const START_CHAT = gql`
  mutation StartChat($influencerId: String!) {
    startChat(influencerId: $influencerId) {
      id
      customerId
      influencerId
      messages {
        id
        chatId
        role
        content
        imageUrl
        createdAt
      }
      influencer {
        id
        name
        avatar
        contentStyle
        isActive
      }
      createdAt
    }
  }
`;

export const CREATE_CHAT_NOTE = gql`
  mutation CreateChatNote($chatId: String!, $content: String!, $title: String) {
    createChatNote(chatId: $chatId, content: $content, title: $title) {
      id
      chatId
      userId
      title
      content
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_CHAT_NOTE = gql`
  mutation UpdateChatNote($noteId: String!, $content: String!, $title: String) {
    updateChatNote(noteId: $noteId, content: $content, title: $title) {
      id
      chatId
      userId
      title
      content
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_CHAT_NOTE = gql`
  mutation DeleteChatNote($noteId: String!) {
    deleteChatNote(noteId: $noteId)
  }
`;
