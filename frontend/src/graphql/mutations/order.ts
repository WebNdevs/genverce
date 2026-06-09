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
      status
      price
      package
      deliveryType
      aiDisclosure
      projectBrief
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
