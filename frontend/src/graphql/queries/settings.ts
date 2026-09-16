import { gql } from '@apollo/client';

export const GET_SITE_SETTINGS = gql`
  query GetSiteSettings {
    siteSettings {
      chatProvider
      chatApiUrl
      chatApiKey
      chatModel
    }
  }
`;
