import { gql } from '@apollo/client';

export const GET_INFLUENCERS = gql`
  query GetInfluencers($filter: FilterInfluencerInput) {
    influencers(filter: $filter) {
      influencers {
        id
        name
        bio
        avatar
        industries
        contentStyle
        languages
        rating
        totalProjects
        totalReviews
        isActive
        hourlyRate
        deletedAt
        portfolio {
          id
          thumbnailUrl
          title
        }
      }
      total
      page
      totalPages
    }
  }
`;

export const GET_INFLUENCER = gql`
  query GetInfluencer($id: String!) {
    influencer(id: $id) {
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
      industries
      contentStyle
      languages
      rating
      totalProjects
      totalReviews
      isActive
      hourlyRate
      voiceId
      systemPrompt
      topic
      outOfTopicMessage
      serviceType
      aiConfig {
        chatApiUrl
        chatApiKey
        chatModel
        scriptApiUrl
        scriptApiKey
        scriptModel
        voiceApiUrl
        voiceApiKey
        voiceModel
        videoApiUrl
        videoApiKey
        videoModel
        imageApiUrl
        imageApiKey
        imageModel
        postApiUrl
        postApiKey
        postModel
      }
      portfolio {
        id
        videoUrl
        thumbnailUrl
        title
        description
      }
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

export const GET_INFLUENCER_ADMIN_EDIT = gql`
  query GetInfluencerAdminEdit($id: String!) {
    influencer(id: $id) {
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
      industries
      contentStyle
      languages
      isActive
      hourlyRate
      voiceId
      systemPrompt
      topic
      outOfTopicMessage
      serviceType
      aiConfig {
        chatApiUrl
        chatApiKey
        chatModel
        scriptApiUrl
        scriptApiKey
        scriptModel
        voiceApiUrl
        voiceApiKey
        voiceModel
        videoApiUrl
        videoApiKey
        videoModel
        imageApiUrl
        imageApiKey
        imageModel
        postApiUrl
        postApiKey
        postModel
      }
    }
  }
`;

export const GET_TOP_INFLUENCERS = gql`
  query GetTopInfluencers($limit: Int) {
    topInfluencers(limit: $limit) {
      id
      name
      bio
      avatar
      industries
      contentStyle
      languages
      rating
      totalProjects
      totalReviews
      isActive
    }
  }
`;

export const GET_FILTER_OPTIONS = gql`
  query GetFilterOptions {
    influencerFilterOptions {
      industries
      contentStyles
      languages
    }
  }
`;
