import { AnthropicProvider } from './anthropic';
import { HeuristicProvider } from './heuristic';
import { OpenAIProvider } from './openai';
import type { AIProvider } from './provider';

export * from './provider';
export { HeuristicProvider } from './heuristic';
export { OpenAIProvider } from './openai';
export { AnthropicProvider } from './anthropic';

export type AIProviderKind = 'heuristic' | 'openai' | 'anthropic';

export interface AIProviderConfig {
  provider?: AIProviderKind | string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  model?: string;
}

/**
 * Resolve an {@link AIProvider} from configuration (typically environment
 * variables). Defaults to the offline heuristic provider, and transparently
 * falls back to it when a hosted provider is selected without an API key.
 */
export function createAIProvider(config: AIProviderConfig = {}): AIProvider {
  const kind = (config.provider ?? 'heuristic').toLowerCase();

  if (kind === 'openai' && config.openaiApiKey) {
    return new OpenAIProvider({ apiKey: config.openaiApiKey, model: config.model });
  }
  if (kind === 'anthropic' && config.anthropicApiKey) {
    return new AnthropicProvider({ apiKey: config.anthropicApiKey, model: config.model });
  }
  return new HeuristicProvider();
}
