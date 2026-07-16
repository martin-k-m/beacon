import type { BeaconSummary } from '../types';
import { HeuristicProvider } from './heuristic';
import { buildSummaryPrompt, type AIProvider, type SummaryInput } from './provider';

export interface OpenAIProviderOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

/**
 * OpenAI-backed summary provider (Chat Completions API). Falls back to the
 * heuristic provider if the request fails, so a transient API error never
 * blocks an analysis.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly fallback = new HeuristicProvider();

  constructor(options: OpenAIProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? 'gpt-4o-mini';
    this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  async generateSummary(input: SummaryInput): Promise<BeaconSummary> {
    const { system, user } = buildSummaryPrompt(input);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.3,
          max_tokens: 220,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI request failed: ${res.status}`);
      const json = (await res.json()) as {
        choices: { message: { content: string } }[];
      };
      const text = json.choices[0]?.message.content?.trim();
      if (!text) throw new Error('Empty OpenAI response');

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
