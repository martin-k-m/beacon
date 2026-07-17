import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { config } from '../config';
import { enqueueAnalysis } from '../queue';
import { getAnalysis } from '../service';
import { recordEvent } from '../store';
import { verifySignature } from '../webhooks-verify';

/** A short, human-readable title for a webhook event, for the timeline. */
const EVENT_TITLES: Record<string, string> = {
  push: 'Commits pushed',
  pull_request: 'Pull request activity',
  issues: 'Issue activity',
  release: 'Release published',
  star: 'Repository starred',
  watch: 'Repository starred',
  fork: 'Repository forked',
};

/** Defensively read a string `action` from a webhook payload, if present. */
function payloadAction(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const action = (body as { action?: unknown }).action;
  return typeof action === 'string' && action.length > 0 ? action : undefined;
}

/** Events that should trigger a fresh analysis of the affected repository. */
const REFRESH_EVENTS = new Set([
  'push',
  'pull_request',
  'issues',
  'release',
  'star',
  'watch',
  'fork',
]);

/** Defensively pull `repository.full_name` from an arbitrary webhook payload. */
function repoFullName(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const repository = (body as { repository?: unknown }).repository;
  if (!repository || typeof repository !== 'object') return undefined;
  const fullName = (repository as { full_name?: unknown }).full_name;
  return typeof fullName === 'string' && fullName.length > 0 ? fullName : undefined;
}

/**
 * GitHub App webhook receiver.
 *
 * POST /api/github/webhooks
 *   - Verifies the X-Hub-Signature-256 HMAC over the raw body when a secret is
 *     configured (401 on missing/invalid). Skips verification with a warning in
 *     dev mode (no secret set) but still processes the event.
 *   - `ping` → 200 { ok: true }.
 *   - Repository events (push, pull_request, issues, release, star, watch,
 *     fork) → fire-and-forget refresh, 202 { accepted: true, ... }.
 *   - Anything else → 202 { accepted: false, event }.
 *
 * A malformed payload never yields a 500 — extraction is fully defensive.
 */
export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/github/webhooks', async (request, reply) => {
    const event = headerValue(request, 'x-github-event');

    // --- Signature verification ---
    if (config.hasWebhookSecret && config.webhookSecret) {
      const signature = headerValue(request, 'x-hub-signature-256');
      const raw = (request as { rawBody?: Buffer }).rawBody;
      if (!raw || !signature || !verifySignature(raw, signature, config.webhookSecret)) {
        return reply.status(401).send({ error: 'Invalid or missing webhook signature.' });
      }
    } else {
      request.log.warn(
        'GITHUB_WEBHOOK_SECRET is not set — skipping webhook signature verification (dev mode).',
      );
    }

    if (!event) {
      return reply.status(400).send({ error: 'Missing X-GitHub-Event header.' });
    }

    // --- Event routing ---
    if (event === 'ping') {
      return reply.status(200).send({ ok: true });
    }

    if (!REFRESH_EVENTS.has(event)) {
      return reply.status(202).send({ accepted: false, event });
    }

    const fullName = repoFullName(request.body);
    if (!fullName) {
      // Valid event but no repository to act on — acknowledge without failing.
      return reply.status(202).send({ accepted: false, event, reason: 'no repository in payload' });
    }

    // Record a timeline event so the history/timeline view populates from
    // monitoring. Fire-and-forget and fully defensive — `recordEvent` swallows
    // its own errors and no-ops without a database, so this never blocks or
    // fails the webhook.
    const [owner, repo] = fullName.split('/');
    if (owner && repo) {
      const action = payloadAction(request.body);
      void recordEvent(owner, repo, {
        type: event,
        title: EVENT_TITLES[event] ?? `${event} event`,
        occurredAt: new Date(),
        ...(action ? { payload: { action } } : {}),
      });
    }

    // Prefer the durable background queue: enqueue a job for @beacon/worker to
    // process. When Redis is not configured, `enqueueAnalysis` returns false and
    // we fall back to a fire-and-forget inline refresh so the webhook still has
    // an effect. Either way GitHub gets a fast 202 and failures are only logged.
    const queued = await enqueueAnalysis(fullName, event);
    if (!queued) {
      void getAnalysis(fullName, { refresh: true }).catch((err: unknown) => {
        request.log.warn(
          `webhook refresh for ${fullName} (${event}) failed: ${(err as Error).message}`,
        );
      });
    }

    return reply
      .status(202)
      .send({ accepted: true, event, repository: fullName, queued });
  });
};

/** Read a header as a single string (Fastify may hand back string | string[]). */
function headerValue(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
}
