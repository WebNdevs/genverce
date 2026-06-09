import { gql } from '@apollo/client';

export const SIGNUP = gql`
  mutation Signup($input: SignupInput!) {
    signup(input: $input) {
      accessToken
      refreshToken
      user {
        id
        name
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
  }
`;

export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
      user {
        id
        name
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
  }
`;

export const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;
