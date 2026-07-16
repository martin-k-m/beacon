/**
 * Authentication for the `beacon` CLI: `login`, `logout`, and `whoami`.
 *
 * Two ways to sign in:
 *
 *  - `--with-token <token>` stores a GitHub Personal Access Token directly.
 *  - Otherwise the GitHub **device flow** is used: the CLI prints a short user
 *    code and a URL, the user authorizes in a browser, and the CLI polls for
 *    the resulting token.
 *
 * The token and resolved user login are written to the global config
 * (`~/.beacon/config.json`). The device flow requires a GitHub OAuth app
 * client ID in `BEACON_GITHUB_CLIENT_ID`; without one, the CLI directs the user
 * to `--with-token`.
 */

import { readGlobalConfig, updateGlobalConfig, writeGlobalConfig } from './config';
import { createPalette } from './render';

/**
 * Documented placeholder client ID. It is intentionally non-functional — set
 * `BEACON_GITHUB_CLIENT_ID` to your own GitHub OAuth app's client ID to enable
 * the device flow, or sign in with `beacon login --with-token <token>`.
 */
export const PLACEHOLDER_CLIENT_ID = 'Iv1.beacon-cli-placeholder';

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';
const DEVICE_VERIFICATION_URL = 'https://github.com/login/device';
const DEFAULT_SCOPE = 'repo read:user';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface AccessTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  interval?: number;
}

interface GitHubUser {
  login: string;
}

/** Resolve the GitHub login for a token, or throw a friendly error. */
export async function fetchGitHubLogin(token: string): Promise<string> {
  const res = await fetch(USER_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'beacon-cli',
    },
  });
  if (!res.ok) {
    throw new Error(
      `Could not verify the token with GitHub (HTTP ${res.status}). ` +
        'Check that it is valid and has not expired.',
    );
  }
  const user = (await res.json()) as GitHubUser;
  if (!user.login) {
    throw new Error('GitHub did not return a user login for this token.');
  }
  return user.login;
}

export interface LoginOptions {
  /** Store this PAT directly instead of running the device flow. */
  withToken?: string;
  color: boolean;
}

/** Run `beacon login`. Returns the resolved login on success. */
export async function runLogin(options: LoginOptions): Promise<void> {
  const palette = createPalette(options.color);
  const out = process.stdout;

  // Direct-token path.
  if (options.withToken) {
    const login = await fetchGitHubLogin(options.withToken);
    updateGlobalConfig({ token: options.withToken, user: { login } });
    out.write(`${palette.green('✓')} Connected as ${palette.bold(login)}\n`);
    return;
  }

  const clientId = process.env.BEACON_GITHUB_CLIENT_ID;
  if (!clientId || clientId === PLACEHOLDER_CLIENT_ID) {
    out.write(
      `${palette.yellow('!')} The GitHub device flow needs an OAuth app client ID.\n\n` +
        `  Set ${palette.bold('BEACON_GITHUB_CLIENT_ID')} to your GitHub OAuth app's client ID,\n` +
        `  or sign in with a token instead:\n\n` +
        `    ${palette.cyan('beacon login --with-token <token>')}\n\n` +
        `  Create a token at ${palette.underline('https://github.com/settings/tokens')} (scope: repo, read:user).\n`,
    );
    process.exitCode = 1;
    return;
  }

  // 1. Request a device + user code.
  const device = await requestDeviceCode(clientId);

  out.write(
    `\nFirst, copy your one-time code:\n\n` +
      `    ${palette.bold(palette.cyan(device.user_code))}\n\n` +
      `Then open ${palette.underline(device.verification_uri || DEVICE_VERIFICATION_URL)} ` +
      `and paste it to authorize Beacon.\n\n` +
      `${palette.dim('Waiting for authorization…')}\n`,
  );

  // 2. Poll for the token.
  const token = await pollForToken(clientId, device);
  const login = await fetchGitHubLogin(token);
  updateGlobalConfig({ token, user: { login } });
  out.write(`\n${palette.green('✓')} Connected as ${palette.bold(login)}\n`);
}

async function requestDeviceCode(clientId: string): Promise<DeviceCodeResponse> {
  const res = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, scope: DEFAULT_SCOPE }),
  });
  if (!res.ok) {
    throw new Error(`GitHub device-code request failed (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as DeviceCodeResponse & { error?: string };
  if (data.error || !data.device_code) {
    throw new Error(
      `GitHub rejected the device-code request${data.error ? `: ${data.error}` : ''}. ` +
        'Check BEACON_GITHUB_CLIENT_ID.',
    );
  }
  return data;
}

async function pollForToken(
  clientId: string,
  device: DeviceCodeResponse,
): Promise<string> {
  let intervalMs = Math.max(1, device.interval || 5) * 1000;
  const deadline = Date.now() + Math.max(60, device.expires_in || 900) * 1000;

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const res = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        device_code: device.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const data = (await res.json()) as AccessTokenResponse;

    if (data.access_token) {
      return data.access_token;
    }
    switch (data.error) {
      case 'authorization_pending':
        break;
      case 'slow_down':
        intervalMs += 5000;
        break;
      case 'expired_token':
        throw new Error('The device code expired before authorization. Run `beacon login` again.');
      case 'access_denied':
        throw new Error('Authorization was denied.');
      default:
        if (data.error) {
          throw new Error(`GitHub authorization failed: ${data.error_description ?? data.error}.`);
        }
    }
  }
  throw new Error('Timed out waiting for authorization. Run `beacon login` again.');
}

/** Run `beacon logout` — clear the stored token and user. */
export function runLogout(options: { color: boolean }): void {
  const palette = createPalette(options.color);
  const config = readGlobalConfig();
  if (!config.token && !config.user) {
    process.stdout.write(`${palette.dim('Not logged in.')}\n`);
    return;
  }
  const next = { ...config };
  delete next.token;
  delete next.user;
  writeGlobalConfig(next);
  process.stdout.write(`${palette.green('✓')} Logged out.\n`);
}

/** Run `beacon whoami` — print the current login, or a not-logged-in note. */
export function runWhoami(options: { color: boolean; json?: boolean }): void {
  const config = readGlobalConfig();
  const login = config.user?.login;
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ login: login ?? null })}\n`);
    return;
  }
  const palette = createPalette(options.color);
  if (!login) {
    process.stdout.write(`${palette.dim('Not logged in.')} Run ${palette.cyan('beacon login')}.\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${palette.bold(login)}\n`);
}
