import { gql } from '@apollo/client';

export const GET_INFLUENCER_CHATS = gql`
  query InfluencerChats($influencerId: String!) {
    influencerChats(influencerId: $influencerId) {
      id
      customerId
      influencerId
      customer {
        id
        name
        email
        avatar
      }
      influencer {
        id
        name
        avatar
        contentStyle
      }
      messages {
        id
        role
        content
        imageUrl
        createdAt
      }
      createdAt
    }
  }
`;

export const GET_ALL_CHATS = gql`
  query AllChats {
    allChats {
      id
      customerId
      influencerId
      customer {
        id
        name
        email
        avatar
      }
      influencer {
        id
        name
        avatar
        contentStyle
      }
      messages {
        id
        role
        content
        createdAt
      }
      createdAt
    }
  }
`;

export const GET_ADMIN_CHAT = gql`
  query AdminGetChat($chatId: String!) {
    adminGetChat(chatId: $chatId) {
      id
      customerId
      influencerId
      customer {
        id
        name
        email
        avatar
      }
      influencer {
        id
        name
        avatar
        contentStyle
        isActive
      }
      messages {
        id
        chatId
        role
        content
        imageUrl
        createdAt
      }
      createdAt
    }
  }
`;

export const GET_MY_CHATS = gql`
  query MyChats {
    myChats {
      id
      influencerId
      messages {
        id
        role
        content
        createdAt
      }
      influencer {
        id
        name
        avatar
        contentStyle
        industries
      }
      createdAt
    }
  }
`;
