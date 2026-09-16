import { gql } from '@apollo/client';

export const UPDATE_SITE_SETTINGS = gql`
  mutation UpdateSiteSettings($input: UpdateSiteSettingsInput!) {
    updateSiteSettings(input: $input) {
      chatProvider
      chatApiUrl
      chatApiKey
      chatModel
    }
  }
`;
