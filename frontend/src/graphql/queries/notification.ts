import { gql } from '@apollo/client';

export const GET_MY_NOTIFICATIONS = gql`
  query MyNotifications {
    myNotifications {
      id
      title
      description
      href
      read
      createdAt
    }
  }
`;
