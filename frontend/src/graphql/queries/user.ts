import { gql } from '@apollo/client';

export const GET_ME = gql`
  query GetMe {
    me {
      id
      name
      username
      email
      role
      accountType
      avatar
      company
      isActive
      isOnboarded
      brandName
      productName
      website
      targetAudience
      tone
      createdAt
    }
  }
`;

export const GET_ALL_USERS = gql`
  query GetAllUsers {
    allUsers {
      id
      name
      email
      role
      avatar
      company
      isActive
    }
  }
`;

export const GET_MY_STATS = gql`
  query GetMyStats {
    myStats {
      totalOrders
      totalVideosGenerated
      totalInfluencersHired
    }
  }
`;
