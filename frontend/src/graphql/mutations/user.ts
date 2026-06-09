import { gql } from '@apollo/client';

export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($name: String, $username: String, $avatar: String, $company: String) {
    updateProfile(name: $name, username: $username, avatar: $avatar, company: $company) {
      id
      name
      username
      email
      role
      accountType
      avatar
      company
      isActive
      createdAt
    }
  }
`;

export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
  }
`;

export const COMPLETE_ONBOARDING = gql`
  mutation CompleteOnboarding($input: CompleteOnboardingInput!) {
    completeOnboarding(input: $input) {
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
      industry
      platforms
      contentTypes
      website
      targetAudience
      tone
      requestedCustomInfluencer
      createdAt
    }
  }
`;
