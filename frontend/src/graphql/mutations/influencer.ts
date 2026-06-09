import { gql } from '@apollo/client';

export const UPDATE_INFLUENCER = gql`
  mutation UpdateInfluencer($id: String!, $input: UpdateInfluencerInput!) {
    updateInfluencer(id: $id, input: $input) {
      id
      name
      bio
      avatar
      coverImage
      locationCity
      locationState
      locationCountry
      locationAddress
      locationPincode
      contentStyle
      voiceId
      serviceType
      industries
      languages
      hourlyRate
      totalProjects
      totalReviews
      isActive
      aiConfig {
        chatApiUrl chatApiKey chatModel
        scriptApiUrl scriptApiKey scriptModel
        voiceApiUrl voiceApiKey voiceModel
        videoApiUrl videoApiKey videoModel
        imageApiUrl imageApiKey imageModel
        postApiUrl postApiKey postModel
      }
    }
  }
`;

export const CREATE_INFLUENCER = gql`
  mutation CreateInfluencer($input: CreateInfluencerInput!) {
    createInfluencer(input: $input) {
      id name bio avatar isActive rating totalProjects serviceType
    }
  }
`;

export const UPSERT_INFLUENCER_PACKAGE = gql`
  mutation UpsertInfluencerPackage($influencerId: String!, $input: UpsertInfluencerPackageInput!) {
    upsertInfluencerPackage(influencerId: $influencerId, input: $input) {
      id
      packages {
        id
        influencerId
        type
        name
        price
        videoCount
        description
        isMonthly
        isActive
        sortOrder
        createdAt
      }
    }
  }
`;

export const CREATE_INFLUENCER_PACKAGE = gql`
  mutation CreateInfluencerPackage($influencerId: String!, $input: UpsertInfluencerPackageInput!) {
    createInfluencerPackage(influencerId: $influencerId, input: $input) {
      id
      packages {
        id
        influencerId
        type
        name
        price
        videoCount
        description
        isMonthly
        isActive
        sortOrder
        createdAt
      }
    }
  }
`;

export const UPDATE_INFLUENCER_PACKAGE = gql`
  mutation UpdateInfluencerPackage($id: String!, $input: UpdateInfluencerPackageInput!) {
    updateInfluencerPackage(id: $id, input: $input) {
      id
      packages {
        id
        influencerId
        type
        name
        price
        videoCount
        description
        isMonthly
        isActive
        sortOrder
        createdAt
      }
    }
  }
`;

export const DELETE_INFLUENCER_PACKAGE = gql`
  mutation DeleteInfluencerPackage($id: String!) {
    deleteInfluencerPackage(id: $id)
  }
`;

export const SOFT_DELETE_INFLUENCER = gql`
  mutation SoftDeleteInfluencer($id: String!) {
    softDeleteInfluencer(id: $id) {
      id
      isActive
      deletedAt
    }
  }
`;

export const RESTORE_INFLUENCER = gql`
  mutation RestoreInfluencer($id: String!) {
    restoreInfluencer(id: $id) {
      id
      isActive
      deletedAt
    }
  }
`;
