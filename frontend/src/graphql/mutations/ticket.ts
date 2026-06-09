import { gql } from '@apollo/client';

export const CREATE_TICKET = gql`
  mutation CreateTicket($issue: String!, $orderId: String) {
    createTicket(issue: $issue, orderId: $orderId) {
      id
      issue
      status
      createdAt
    }
  }
`;

export const RESOLVE_TICKET = gql`
  mutation ResolveTicket($id: String!, $resolution: String!) {
    resolveTicket(id: $id, resolution: $resolution) {
      id
      status
      resolution
      updatedAt
    }
  }
`;

export const UPDATE_TICKET_STATUS = gql`
  mutation UpdateTicketStatus($id: String!, $status: TicketStatus!) {
    updateTicketStatus(id: $id, status: $status) {
      id
      status
      updatedAt
    }
  }
`;

export const REOPEN_TICKET = gql`
  mutation ReopenTicket($id: String!, $note: String!) {
    reopenTicket(id: $id, note: $note) {
      id
      status
      resolution
      reopenNote
      updatedAt
    }
  }
`;

export const CREATE_REVIEW = gql`
  mutation CreateReview($orderId: String!, $rating: Float!, $comment: String) {
    createReview(orderId: $orderId, rating: $rating, comment: $comment) {
      id
      rating
      comment
    }
  }
`;
