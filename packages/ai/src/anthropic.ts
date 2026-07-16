import type { BeaconSummary } from '@beacon/shared';
import { HeuristicProvider } from './heuristic';
import { buildSummaryPrompt, type AIProvider, type SummaryInput } from './provider';

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

/**
 * Anthropic (Claude) summary provider (Messages API). Falls back to the
 * heuristic provider on any failure.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly fallback = new HeuristicProvider();

  constructor(options: AnthropicProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? 'claude-sonnet-5';
    this.baseUrl = (options.baseUrl ?? 'https://api.anthropic.com/v1').replace(/\/$/, '');
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  async generateSummary(input: SummaryInput): Promise<BeaconSummary> {
    const { system, user } = buildSummaryPrompt(input);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 300,
          temperature: 0.3,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic request failed: ${res.status}`);
      const json = (await res.json()) as { content: { type: string; text: string }[] };
      const text = json.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('')
        .trim();
      if (!text) throw new Error('Empty Anthropic response');

      const heuristic = await this.fallback.generateSummary(input);
      return {
        provider: this.name,
        model: this.model,
        text,
        highlights: heuristic.highlights,
        generatedAt: new Date().toISOString(),
      };
    } catch {
      return this.fallback.generateSummary(input);
    }
  }
}
