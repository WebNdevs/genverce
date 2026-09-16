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
  format: 'openai' | 'anthropic';
  description?: string;
}

export const AI_PROVIDERS: AIProvider[] = [
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

export function getAIProvider(providerId?: string | null): AIProvider {
  const id = (providerId ?? '').trim().toLowerCase();
  const found = AI_PROVIDERS.find((p) => p.id === id);
  return found || AI_PROVIDERS[0]; // fallback to OpenAI
}

export function detectProvider(
  chatProvider?: string | null,
  chatApiUrl?: string | null,
  chatModel?: string | null,
  envVars?: { anthropicKey?: string; openaiKey?: string },
): AIProvider {
  // 1. Explicit provider ID
  if (chatProvider && chatProvider.trim()) {
    const p = AI_PROVIDERS.find((item) => item.id === chatProvider.trim().toLowerCase());
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
