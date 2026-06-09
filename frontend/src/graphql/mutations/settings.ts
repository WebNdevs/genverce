import { gql } from '@apollo/client';

export const UPDATE_SITE_SETTINGS = gql`
  mutation UpdateSiteSettings($input: UpdateSiteSettingsInput!) {
    updateSiteSettings(input: $input) {
      chatApiUrl
      chatApiKey
      chatModel
    }
  }
`;
