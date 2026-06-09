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
