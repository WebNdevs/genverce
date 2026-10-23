export interface AIProvider {
  id: string;
  name: string;
  defaultBaseURL: string;
  defaultModel: string;
  models: string[];
  requiresApiKey: boolean;
  requiresCustomUrl?: boolean;
  apiKeyPlaceholder?: string;
  apiKeyHint?: string;
  baseUrlHint?: string;
  extraHeaders?: Record<string, string>;
  format?: 'openai' | 'anthropic';
  description?: string;
}

// ─── CHAT PROVIDERS ─────────────────────────────────────────────────────────

export const CHAT_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    defaultBaseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1', 'o1-mini'],
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-proj-...',
    apiKeyHint: 'Your OpenAI API key from platform.openai.com',
    format: 'openai',
    description: 'Official OpenAI models (GPT-4o, GPT-4o-mini, o3-mini, o1)',
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    defaultBaseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-ant-...',
    apiKeyHint: 'Your Anthropic API key from console.anthropic.com',
    format: 'anthropic',
    description: 'Anthropic Claude models (Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus)',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    defaultBaseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    defaultModel: 'gemini-3.6-flash',
    models: ['gemini-3.6-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    requiresApiKey: true,
    apiKeyPlaceholder: 'AIzaSy...',
    apiKeyHint: 'Your Google Gemini API key from aistudio.google.com',
    format: 'openai',
    description: 'Google Gemini models via OpenAI compatibility API',
  },
  {
    id: 'grok',
    name: 'Grok (xAI)',
    defaultBaseURL: 'https://api.x.ai/v1',
    defaultModel: 'grok-2-1212',
    models: ['grok-2-1212', 'grok-2-vision-1212', 'grok-2'],
    requiresApiKey: true,
    apiKeyPlaceholder: 'xai-...',
    apiKeyHint: 'Your xAI API key from console.x.ai',
    format: 'openai',
    description: 'xAI Grok flagship reasoning and vision models',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultBaseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-...',
    apiKeyHint: 'Your DeepSeek API key from platform.deepseek.com',
    format: 'openai',
    description: 'DeepSeek V3 chat and R1 reasoning models',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultBaseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o',
    models: [
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-3.6-flash',
      'deepseek/deepseek-chat',
      'deepseek/deepseek-r1',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-or-v1-...',
    apiKeyHint: 'Your OpenRouter API key from openrouter.ai',
    extraHeaders: {
      'HTTP-Referer': 'https://genverce.ai',
      'X-Title': 'Genverce',
    },
    format: 'openai',
    description: 'Unified gateway for latest open & proprietary models',
  },
  {
    id: 'custom',
    name: 'Custom API',
    defaultBaseURL: '',
    defaultModel: '',
    models: [],
    requiresApiKey: false,
    requiresCustomUrl: true,
    apiKeyPlaceholder: 'API Key (optional)',
    baseUrlHint: 'Enter full custom API base URL (e.g. https://my-custom-proxy.com/v1)',
    format: 'openai',
    description: 'Custom or self-hosted OpenAI-compatible endpoint',
  },
];

// Backwards-compatible alias for existing imports
export const AI_PROVIDERS = CHAT_PROVIDERS;

// ─── AUDIO / VOICE PROVIDERS ────────────────────────────────────────────────

export const AUDIO_PROVIDERS: AIProvider[] = [
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    defaultBaseURL: 'https://api.elevenlabs.io/v1',
    defaultModel: 'eleven_multilingual_v2',
    models: [
      'eleven_multilingual_v2',
      'eleven_turbo_v2_5',
      'eleven_flash_v2_5',
      'eleven_monolingual_v1',
    ],
    requiresApiKey: true,
    apiKeyPlaceholder: 'xi-...',
    apiKeyHint: 'Your ElevenLabs API key from elevenlabs.io',
    description: 'Industry-leading realistic AI voice synthesis and custom voice cloning',
  },
  {
    id: 'openai_audio',
    name: 'OpenAI Audio (TTS)',
    defaultBaseURL: 'https://api.openai.com/v1',
    defaultModel: 'tts-1-hd',
    models: ['tts-1-hd', 'tts-1', 'whisper-1'],
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-proj-...',
    apiKeyHint: 'Your OpenAI API key with Audio permissions',
    description: 'Official OpenAI speech generation and audio transcription',
  },
  {
    id: 'playht',
    name: 'PlayHT',
    defaultBaseURL: 'https://api.play.ht/api/v2',
    defaultModel: 'Play3.0-mini',
    models: ['Play3.0-mini', 'PlayHT2.0-turbo', 'PlayHT2.0'],
    requiresApiKey: true,
    apiKeyPlaceholder: 'PlayHT secret key...',
    apiKeyHint: 'Your PlayHT API Secret Key from play.ht',
    description: 'Conversational and expressive voice generation with emotional nuance',
  },
  {
    id: 'deepgram',
    name: 'Deepgram Aura',
    defaultBaseURL: 'https://api.deepgram.com/v1',
    defaultModel: 'aura-asteria-en',
    models: [
      'aura-asteria-en',
      'aura-luna-en',
      'aura-stella-en',
      'aura-athena-en',
      'nova-2',
    ],
    requiresApiKey: true,
    apiKeyPlaceholder: 'Token ...',
    apiKeyHint: 'Your Deepgram API Key from deepgram.com',
    description: 'Sub-second low-latency streaming text-to-speech & audio AI',
  },
  {
    id: 'cartesia',
    name: 'Cartesia Sonic',
    defaultBaseURL: 'https://api.cartesia.ai',
    defaultModel: 'sonic-english',
    models: ['sonic-english', 'sonic-multilingual'],
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk_car_...',
    apiKeyHint: 'Your Cartesia Sonic API Key from cartesia.ai',
    description: 'Ultra-low latency expressive generative speech models',
  },
  {
    id: 'custom',
    name: 'Custom Audio API',
    defaultBaseURL: '',
    defaultModel: '',
    models: [],
    requiresApiKey: false,
    requiresCustomUrl: true,
    apiKeyPlaceholder: 'API Key (optional)',
    baseUrlHint: 'Enter full custom Audio/TTS endpoint (e.g. https://my-tts-proxy.com/v1)',
    description: 'Custom or self-hosted TTS/Audio endpoint',
  },
];

// ─── VIDEO GENERATION PROVIDERS ─────────────────────────────────────────────

export const VIDEO_PROVIDERS: AIProvider[] = [
  {
    id: 'runway',
    name: 'RunwayML (Gen-3)',
    defaultBaseURL: 'https://api.dev.runwayml.com/v1',
    defaultModel: 'gen3a_turbo',
    models: ['gen3a_turbo', 'gen3', 'gen2'],
    requiresApiKey: true,
    apiKeyPlaceholder: 'key_...',
    apiKeyHint: 'Your Runway developer API key from runwayml.com',
    description: 'Runway Gen-3 Alpha cinematic video generation with temporal coherence',
  },
  {
    id: 'luma',
    name: 'Luma AI (Dream Machine)',
    defaultBaseURL: 'https://api.lumalabs.ai/dream-machine/v1',
    defaultModel: 'ray-2',
    models: ['ray-2', 'ray-1-6'],
    requiresApiKey: true,
    apiKeyPlaceholder: 'luma-...',
    apiKeyHint: 'Your Luma AI Dream Machine API key from lumalabs.ai',
    description: 'Luma Dream Machine Ray-2 photorealistic video with realistic physics',
  },
  {
    id: 'kling',
    name: 'Kling AI',
    defaultBaseURL: 'https://api.klingai.com/v1',
    defaultModel: 'kling-v1-6',
    models: ['kling-v1-6', 'kling-v1-5', 'kling-v1'],
    requiresApiKey: true,
    apiKeyPlaceholder: 'kling-...',
    apiKeyHint: 'Your Kling AI API developer key from klingai.com',
    description: 'High-motion fidelity cinematic video generation up to 1080p',
  },
  {
    id: 'sora',
    name: 'OpenAI Video (Sora)',
    defaultBaseURL: 'https://api.openai.com/v1',
    defaultModel: 'sora-1.0',
    models: ['sora-1.0', 'sora-turbo'],
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-proj-...',
    apiKeyHint: 'Your OpenAI API key with Sora video generation access',
    description: 'OpenAI Sora video generation pipeline and creative controls',
  },
  {
    id: 'pika',
    name: 'Pika',
    defaultBaseURL: 'https://api.pika.art/v1',
    defaultModel: 'pika-2.0',
    models: ['pika-2.0', 'pika-1.5'],
    requiresApiKey: true,
    apiKeyPlaceholder: 'pika-...',
    apiKeyHint: 'Your Pika Developer API key from pika.art',
    description: 'Idea-to-video platform with special effects and camera movements',
  },
  {
    id: 'haiper',
    name: 'Haiper AI',
    defaultBaseURL: 'https://api.haiper.ai/v1',
    defaultModel: 'haiper-video-2',
    models: ['haiper-video-2', 'haiper-video-1'],
    requiresApiKey: true,
    apiKeyPlaceholder: 'hp_...',
    apiKeyHint: 'Your Haiper API developer token from haiper.ai',
    description: 'Perceptual video foundation models for viral creator content',
  },
  {
    id: 'custom',
    name: 'Custom Video API',
    defaultBaseURL: '',
    defaultModel: '',
    models: [],
    requiresApiKey: false,
    requiresCustomUrl: true,
    apiKeyPlaceholder: 'API Key (optional)',
    baseUrlHint: 'Enter full custom Video API endpoint (e.g. https://my-video-pipeline.com/v1)',
    description: 'Custom or self-hosted AI video generation pipeline endpoint',
  },
];

// ─── CHAT GETTERS & DETECTION ───────────────────────────────────────────────

export function getAIProvider(providerId?: string | null): AIProvider {
  const id = (providerId ?? '').trim().toLowerCase();
  const found = CHAT_PROVIDERS.find((p) => p.id === id);
  return found || CHAT_PROVIDERS[0]; // fallback to OpenAI
}

export function detectProvider(
  chatProvider?: string | null,
  chatApiUrl?: string | null,
  chatModel?: string | null,
  envVars?: { anthropicKey?: string; openaiKey?: string },
): AIProvider {
  // 1. Explicit provider ID
  if (chatProvider && chatProvider.trim()) {
    const p = CHAT_PROVIDERS.find((item) => item.id === chatProvider.trim().toLowerCase());
    if (p) return p;
  }

  // 2. Detect from API URL
  const url = (chatApiUrl ?? '').trim().toLowerCase();
  if (url) {
    if (url.includes('anthropic')) return getAIProvider('anthropic');
    if (url.includes('openai.com')) return getAIProvider('openai');
    if (url.includes('googleapis') || url.includes('generativelanguage')) return getAIProvider('gemini');
    if (url.includes('x.ai')) return getAIProvider('grok');
    if (url.includes('deepseek')) return getAIProvider('deepseek');
    if (url.includes('openrouter')) return getAIProvider('openrouter');
    return getAIProvider('custom');
  }

  // 3. Detect from Model name
  const model = (chatModel ?? '').trim().toLowerCase();
  if (model) {
    if (model.startsWith('claude')) return getAIProvider('anthropic');
    if (model.startsWith('gpt-') || model.startsWith('o1-') || model.startsWith('o3-')) return getAIProvider('openai');
    if (model.startsWith('gemini')) return getAIProvider('gemini');
    if (model.startsWith('grok')) return getAIProvider('grok');
    if (model.startsWith('deepseek')) return getAIProvider('deepseek');
    if (model.includes('/')) return getAIProvider('openrouter');
  }

  // 4. Detect from Environment
  if (envVars?.anthropicKey && !envVars?.openaiKey) {
    return getAIProvider('anthropic');
  }

  // 5. Default
  return getAIProvider('openai');
}

// ─── AUDIO GETTERS & DETECTION ──────────────────────────────────────────────

export function getAudioProvider(providerId?: string | null): AIProvider {
  const id = (providerId ?? '').trim().toLowerCase();
  const found = AUDIO_PROVIDERS.find((p) => p.id === id);
  return found || AUDIO_PROVIDERS[0]; // fallback to ElevenLabs
}

export function detectAudioProvider(
  audioProvider?: string | null,
  audioApiUrl?: string | null,
  audioModel?: string | null,
  envVars?: { elevenLabsKey?: string; openaiKey?: string },
): AIProvider {
  if (audioProvider && audioProvider.trim()) {
    const p = AUDIO_PROVIDERS.find((item) => item.id === audioProvider.trim().toLowerCase());
    if (p) return p;
  }

  const url = (audioApiUrl ?? '').trim().toLowerCase();
  if (url) {
    if (url.includes('elevenlabs')) return getAudioProvider('elevenlabs');
    if (url.includes('openai')) return getAudioProvider('openai_audio');
    if (url.includes('play.ht')) return getAudioProvider('playht');
    if (url.includes('deepgram')) return getAudioProvider('deepgram');
    if (url.includes('cartesia')) return getAudioProvider('cartesia');
    return getAudioProvider('custom');
  }

  const model = (audioModel ?? '').trim().toLowerCase();
  if (model) {
    if (model.startsWith('eleven')) return getAudioProvider('elevenlabs');
    if (model.startsWith('tts-') || model.startsWith('whisper')) return getAudioProvider('openai_audio');
    if (model.startsWith('play')) return getAudioProvider('playht');
    if (model.startsWith('aura')) return getAudioProvider('deepgram');
    if (model.startsWith('sonic')) return getAudioProvider('cartesia');
  }

  if (envVars?.elevenLabsKey) return getAudioProvider('elevenlabs');
  if (envVars?.openaiKey) return getAudioProvider('openai_audio');

  return getAudioProvider('elevenlabs');
}

// ─── VIDEO GETTERS & DETECTION ──────────────────────────────────────────────

export function getVideoProvider(providerId?: string | null): AIProvider {
  const id = (providerId ?? '').trim().toLowerCase();
  const found = VIDEO_PROVIDERS.find((p) => p.id === id);
  return found || VIDEO_PROVIDERS[0]; // fallback to Runway
}

export function detectVideoProvider(
  videoProvider?: string | null,
  videoApiUrl?: string | null,
  videoModel?: string | null,
  envVars?: { runwayKey?: string; lumaKey?: string; openaiKey?: string },
): AIProvider {
  if (videoProvider && videoProvider.trim()) {
    const p = VIDEO_PROVIDERS.find((item) => item.id === videoProvider.trim().toLowerCase());
    if (p) return p;
  }

  const url = (videoApiUrl ?? '').trim().toLowerCase();
  if (url) {
    if (url.includes('runway')) return getVideoProvider('runway');
    if (url.includes('luma')) return getVideoProvider('luma');
    if (url.includes('kling')) return getVideoProvider('kling');
    if (url.includes('openai')) return getVideoProvider('sora');
    if (url.includes('pika')) return getVideoProvider('pika');
    if (url.includes('haiper')) return getVideoProvider('haiper');
    return getVideoProvider('custom');
  }

  const model = (videoModel ?? '').trim().toLowerCase();
  if (model) {
    if (model.startsWith('gen3') || model.startsWith('gen2')) return getVideoProvider('runway');
    if (model.startsWith('ray-')) return getVideoProvider('luma');
    if (model.startsWith('kling')) return getVideoProvider('kling');
    if (model.startsWith('sora')) return getVideoProvider('sora');
    if (model.startsWith('pika')) return getVideoProvider('pika');
    if (model.startsWith('haiper')) return getVideoProvider('haiper');
  }

  if (envVars?.runwayKey) return getVideoProvider('runway');
  if (envVars?.lumaKey) return getVideoProvider('luma');

  return getVideoProvider('runway');
}
