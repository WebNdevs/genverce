import { gql } from '@apollo/client';

export const CREATE_ORDER = gql`
  mutation CreateOrder($input: CreateOrderInput!) {
    createOrder(input: $input) {
      id
      status
      price
      package
      deliveryType
      videosOrdered
      createdAt
    }
  }
`;

export const CREATE_CHECKOUT_SESSION = gql`
  mutation CreateCheckoutSession($orderId: String!) {
    createCheckoutSession(orderId: $orderId) {
      sessionId
      url
    }
  }
`;

export const APPROVE_ORDER = gql`
  mutation ApproveOrder($id: String!) {
    approveOrder(id: $id) {
      id
      status
    }
  }
`;

export const REJECT_ORDER = gql`
  mutation RejectOrder($id: String!, $notes: String!) {
    rejectOrder(id: $id, notes: $notes) {
      id
      status
      reviewNotes
    }
  }
`;

export const ADMIN_CREATE_ORDER = gql`
  mutation AdminCreateOrder($input: AdminCreateOrderInput!) {
    adminCreateOrder(input: $input) {
      id
      status
      price
      package
      deliveryType
      videosOrdered
      createdAt
      customer {
        id
        name
        email
      }
    }
  }
`;

export const ADMIN_UPDATE_ORDER = gql`
  mutation AdminUpdateOrder($input: AdminUpdateOrderInput!) {
    adminUpdateOrder(input: $input) {
      id
      customerId
      influencerId
      status
      price
      package
      deliveryType
      aiDisclosure
      videoUrl
      thumbnailUrl
      videosOrdered
      videosDelivered
      deliveredAt
      createdAt
      projectBrief
      influencer {
        id
        name
        avatar
        serviceType
        rating
      }
      customer {
        id
        name
        email
        avatar
        company
      }
      generatedImages {
        url
        messageId
        createdAt
        delivered
        deliveredAt
      }
    }
  }
`;

export const REQUEST_REFUND = gql`
  mutation RequestRefund($orderId: String!) {
    requestRefund(orderId: $orderId) {
      id
      status
      refundedAmount
    }
  }
`;

export const ADMIN_GENERATE_ORDER_VIDEO = gql`
  mutation AdminGenerateOrderVideo(
    $orderId: String!
    $prompt: String
    $duration: String
    $aspectRatio: String
    $videoProvider: String
    $videoModel: String
  ) {
    adminGenerateOrderVideo(
      orderId: $orderId
      prompt: $prompt
      duration: $duration
      aspectRatio: $aspectRatio
      videoProvider: $videoProvider
      videoModel: $videoModel
    ) {
      id
      customerId
      influencerId
      status
      price
      package
      deliveryType
      videoUrl
      thumbnailUrl
      videosOrdered
      videosDelivered
      deliveredAt
      createdAt
      projectBrief
      influencer {
        id
        name
        avatar
        serviceType
        rating
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

export const ADMIN_SEND_ORDER_VIDEO_TO_CLIENT = gql`
  mutation AdminSendOrderVideoToClient(
    $orderId: String!
    $videoUrl: String
    $customMessage: String
    $notes: String
  ) {
    adminSendOrderVideoToClient(
      orderId: $orderId
      videoUrl: $videoUrl
      customMessage: $customMessage
      notes: $notes
    ) {
      id
      customerId
      influencerId
      status
      price
      package
      deliveryType
      videoUrl
      thumbnailUrl
      videosOrdered
      videosDelivered
      deliveredAt
      createdAt
      projectBrief
      influencer {
        id
        name
        avatar
        serviceType
        rating
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

