import { gql } from '@apollo/client';

export const GET_FAQ_ENTRIES = gql`
  query FaqEntries {
    faqEntries {
      id
      question
      answers
      keywords
      isActive
      createdAt
    }
  }
`;
