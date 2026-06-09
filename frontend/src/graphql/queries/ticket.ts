import { gql } from '@apollo/client';

export const GET_ALL_TICKETS = gql`
  query GetAllTickets {
    allTickets {
      id
      status
    }
  }
`;