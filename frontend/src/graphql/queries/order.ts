import { gql } from '@apollo/client';

export const GET_DASHBOARD_DATA = gql`
  query GetDashboardData {
    myOrders {
      id
      package
      deliveryType
      status
      price
      videoUrl
      aiDisclosure
      videosOrdered
      videosDelivered
      createdAt
      influencer {
        id
        name
        avatar
      }
    }
    myStats {
      totalOrders
      totalVideosGenerated
      totalInfluencersHired
    }
  }
`;

export const GET_MY_ORDERS = gql`
  query GetMyOrders {
    myOrders {
      id
      influencerId
      projectBrief
      package
      deliveryType
      status
      price
      videoUrl
      thumbnailUrl
      deliveredAt
      generatedImages {
        url
        messageId
        createdAt
        delivered
        deliveredAt
      }
      aiDisclosure
      videosOrdered
      videosDelivered
      createdAt
      influencer {
        id
        name
        avatar
        industries
        serviceType
      }
      review {
        id
      }
    }
  }
`;

export const GET_ORDER = gql`
  query GetOrder($id: String!) {
    order(id: $id) {
      id
      customerId
      influencerId
      projectBrief
      package
      deliveryType
      status
      price
      videoUrl
      thumbnailUrl
      generatedImages {
        url
        messageId
        createdAt
        delivered
        deliveredAt
      }
      aiDisclosure
      reviewNotes
      reviewedBy
      reviewedAt
      deliveredAt
      videosOrdered
      videosDelivered
      createdAt
      influencer {
        id
        name
        avatar
        bio
        industries
        serviceType
      }
      customer {
        id
        name
        email
        avatar
        company
      }
    }
  }
`;

export const GET_ALL_ORDERS = gql`
  query GetAllOrders($status: OrderStatus) {
    allOrders(status: $status) {
      id
      customerId
      influencerId
      projectBrief
      package
      status
      price
      videoUrl
      createdAt
      influencer {
        id
        name
        avatar
      }
      customer {
        id
        name
        email
      }
    }
  }
`;

export const GET_INFLUENCER_ORDERS = gql`
  query GetInfluencerOrders($influencerId: String!) {
    influencerOrders(influencerId: $influencerId) {
      id
      customerId
      package
      deliveryType
      status
      price
      videosOrdered
      videosDelivered
      aiDisclosure
      reviewNotes
      reviewedAt
      deliveredAt
      createdAt
      projectBrief
      generatedImages {
        url
        messageId
        createdAt
        delivered
        deliveredAt
      }
      customer {
        id
        name
        email
        avatar
        company
      }
      influencer {
        id
        name
        serviceType
      }
    }
  }
`;

export const GET_PENDING_REVIEW_ORDERS = gql`
  query GetPendingReviewOrders {
    pendingReviewOrders {
      id
      projectBrief
      package
      status
      price
      videoUrl
      createdAt
      influencer {
        id
        name
        avatar
      }
      customer {
        id
        name
        email
      }
    }
  }
`;
