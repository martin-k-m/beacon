# Embeddable widgets

Beacon renders self-contained **SVG** widgets you can embed in a README, a
profile, a portfolio, or any web page. Widgets have no external fonts or assets —
the SVG is fully standalone — and are served by the Beacon API with caching.

Implementation: [`packages/widgets`](../packages/widgets). Served by the API
routes in `apps/api`.

## Widget types

| Type | Shows |
| --- | --- |
| `health` | Repository name, Beacon Score ring, grade, pillar bars, key stats |
| `activity` | 52-week commit sparkline + recent commit/contributor totals |
| `language` | Language breakdown bar + legend |
| `contributor` | Top contributors and their relative contributions |
| `release` | Latest release + recent releases |
| `badge` | A small shields-style maintenance badge |

## Embedding

Widgets are served from your Beacon host. Replace `<your-beacon-host>` with where
you run Beacon (there is no public hosted service — Beacon is self-hosted).

**Markdown** (health card):

```markdown
[![Beacon health](https://<your-beacon-host>/widget/repo/facebook/react)](https://github.com/facebook/react)
```

**Maintenance badge:**

```markdown
[![Beacon](https://<your-beacon-host>/badge/facebook/react)](https://github.com/facebook/react)
```

**HTML:**

```html
<a href="https://github.com/facebook/react">
  <img src="https://<your-beacon-host>/widget/health/facebook/react?theme=dark" alt="Beacon health" />
</a>
```

## URLs

```
GET /widget/repo/:owner/:repo            # canonical health card
GET /widget/:type/:owner/:repo           # any widget type
GET /badge/:owner/:repo                  # maintenance badge
```

### Query options

| Param | Values | Default |
| --- | --- | --- |
| `theme` | `dark`, `light`, `transparent` | `dark` |
| `size` | `small`, `medium`, `large` | `medium` (`small` for badges) |
| `accent` | any CSS color | Beacon amber |

Example: `/widget/language/vercel/next.js?theme=light&size=large`.

## From the CLI

```bash
beacon widget facebook/react --type health --theme dark
beacon badge facebook/react
beacon widget facebook/react --out health.svg      # save the SVG locally
```

The CLI prints ready-to-paste Markdown and HTML embed snippets. Use `--host` to
point the snippets at your deployment.

## Programmatic use

```ts
import { renderWidget, embedSnippets } from '@beacon/widgets';

const svg = renderWidget('health', analysis, { theme: 'dark', size: 'medium' });
const { markdown } = embedSnippets('https://beacon.example.com', 'facebook', 'react');
```

## Caching & reliability

Rendered SVGs are cached (Redis or in-memory) and served with `Cache-Control`
headers. If a repository can't be analyzed (not found, rate-limited), the widget
endpoints return a small "unavailable" SVG with `200` and a short cache lifetime,
so an embed never renders as a broken image.
