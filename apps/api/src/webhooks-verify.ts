import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify a GitHub webhook signature.
 *
 * GitHub signs the *raw* request body with the shared webhook secret using
 * HMAC-SHA256 and sends the result as the `X-Hub-Signature-256` header in the
 * form `sha256=<hex>`. We recompute the digest over the exact bytes received
 * and compare in constant time.
 *
 * Returns `true` only when the signature is present, well-formed, and matches.
 * A pure function (no I/O) so it can be unit-tested in isolation.
 */
export function verifySignature(
  raw: Buffer | string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  // Expected format: "sha256=<64 hex chars>".
  const prefix = 'sha256=';
  if (!signature.startsWith(prefix)) return false;
  const provided = signature.slice(prefix.length);
  if (provided.length === 0) return false;

  const body = typeof raw === 'string' ? Buffer.from(raw, 'utf8') : raw;
  const expected = createHmac('sha256', secret).update(body).digest('hex');

  // timingSafeEqual requires equal-length buffers, so bail early on a length
  // mismatch (which also prevents it from throwing).
  const providedBuf = Buffer.from(provided, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (providedBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(providedBuf, expectedBuf);
}
