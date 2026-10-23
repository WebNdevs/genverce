import { gql } from '@apollo/client';

export const ADMIN_GENERATE_STANDALONE_VIDEO = gql`
  mutation AdminGenerateStandaloneVideo(
    $prompt: String!
    $title: String
    $duration: String
    $aspectRatio: String
    $videoProvider: String
    $videoModel: String
  ) {
    adminGenerateStandaloneVideo(
      prompt: $prompt
      title: $title
      duration: $duration
      aspectRatio: $aspectRatio
      videoProvider: $videoProvider
      videoModel: $videoModel
    ) {
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

export const ADMIN_DELETE_STANDALONE_VIDEO = gql`
  mutation AdminDeleteStandaloneVideo($id: String!) {
    adminDeleteStandaloneVideo(id: $id)
  }
`;
