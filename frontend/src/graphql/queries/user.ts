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

export const ADMIN_USER_HIRED_AGENTS = gql`
  query AdminUserHiredAgents($userId: String!) {
    adminUserHiredAgents(userId: $userId) {
      influencerId
      influencerName
      avatar
      serviceType
      orderId
      status
      createdAt
    }
  }
`;

export const GET_MY_HIRED_AGENTS_OVERVIEW = gql`
  query GetMyHiredAgentsOverview {
    myHiredAgentsOverview {
      totalAgents
      activeAgents
      totalRemainingOrders
      totalCompletedOrders
      totalPendingOrders
      agents {
        influencerId
        influencerName
        avatar
        serviceType
        bio
        orderId
        status
        totalOrders
        completedOrders
        pendingOrders
        remainingOrders
        totalOrderedUnits
        totalDeliveredUnits
        remainingUnits
        chatId
        latestOrderDate
      }
    }
  }
`;

