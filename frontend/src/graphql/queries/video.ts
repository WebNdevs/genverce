import { gql } from '@apollo/client';

export const ADMIN_GET_STANDALONE_VIDEOS = gql`
  query AdminGetStandaloneVideos($search: String, $status: String) {
    adminGetStandaloneVideos(search: $search, status: $status) {
      id
      title
      prompt
      videoUrl
      thumbnailUrl
      provider
      model
      duration
      aspectRatio
      status
      metadata
      createdAt
      updatedAt
    }
  }
`;
