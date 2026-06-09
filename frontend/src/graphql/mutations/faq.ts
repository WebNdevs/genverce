import { gql } from '@apollo/client';

export const CREATE_FAQ_ENTRY = gql`
  mutation CreateFaqEntry($input: CreateFaqInput!) {
    createFaqEntry(input: $input) {
      id question answers keywords isActive createdAt
    }
  }
`;

export const UPDATE_FAQ_ENTRY = gql`
  mutation UpdateFaqEntry($id: ID!, $input: UpdateFaqInput!) {
    updateFaqEntry(id: $id, input: $input) {
      id question answers keywords isActive createdAt
    }
  }
`;

export const DELETE_FAQ_ENTRY = gql`
  mutation DeleteFaqEntry($id: ID!) {
    deleteFaqEntry(id: $id)
  }
`;
