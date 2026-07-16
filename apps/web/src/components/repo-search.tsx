'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface RepoSearchProps {
  className?: string;
  /** Compact variant for dashboard headers. */
  size?: 'lg' | 'md';
  autoFocus?: boolean;
  placeholder?: string;
}

/**
 * Parse an `owner/repo` slug or a full GitHub URL into its coordinates.
 * Returns null if the input can't be resolved.
 */
export function parseRepoInput(raw: string): { owner: string; repo: string } | null {
  const value = raw.trim();
  if (!value) return null;

  // Full URL (with or without protocol): github.com/owner/repo/...
  const urlMatch = value.match(
    /github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i,
  );
  if (urlMatch && urlMatch[1] && urlMatch[2]) {
    return { owner: urlMatch[1], repo: stripGitSuffix(urlMatch[2]) };
  }

  // Bare "owner/repo".
  const slugMatch = value.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (slugMatch && slugMatch[1] && slugMatch[2]) {
    return { owner: slugMatch[1], repo: stripGitSuffix(slugMatch[2]) };
  }

  return null;
}

function stripGitSuffix(repo: string): string {
  return repo.replace(/\.git$/i, '');
}

const SUGGESTIONS: Array<{ label: string; slug: string }> = [
  { label: 'beacon-labs/aurora', slug: 'beacon-labs/aurora' },
  { label: 'beacon-labs/legacy-cli', slug: 'beacon-labs/legacy-cli' },
];

/** The repository search box. On submit, routes to the analysis page. */
export function RepoSearch({
  className,
  size = 'lg',
  autoFocus = false,
  placeholder = 'owner/repo  or  https://github.com/owner/repo',
}: RepoSearchProps): React.JSX.Element {
  const router = useRouter();
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const go = React.useCallback(
    (raw: string) => {
      const parsed = parseRepoInput(raw);
      if (!parsed) {
        setError('Enter a repository as owner/repo or a GitHub URL.');
        return;
      }
      setError(null);
      router.push(
        `/dashboard/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`,
      );
    },
    [router],
  );

  const onSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    go(value);
  };

  return (
    <div className={cn('w-full', className)}>
      <form
        onSubmit={onSubmit}
        className={cn(
          'glass group flex items-center gap-2 rounded-full pl-4 pr-2 transition-shadow focus-within:shadow-glow',
          size === 'lg' ? 'h-14' : 'h-12',
        )}
      >
        <Search className="size-5 shrink-0 text-muted-foreground" />
        <input
          type="text"
          inputMode="text"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder={placeholder}
          aria-label="Repository to analyze"
          className={cn(
            'min-w-0 flex-1 bg-transparent font-mono text-foreground placeholder:text-muted-foreground/70 focus:outline-none',
            size === 'lg' ? 'text-base' : 'text-sm',
          )}
        />
        <Button
          type="submit"
          size={size === 'lg' ? 'md' : 'sm'}
          className="rounded-full"
        >
          Analyze
          <ArrowRight className="size-4" />
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 px-2 text-xs text-muted-foreground">
        {error ? (
          <span className="text-danger">{error}</span>
        ) : (
          <>
            <span>Try</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => {
                  setValue(s.slug);
                  go(s.slug);
                }}
                className="rounded-full border border-border bg-surface-2 px-2.5 py-1 font-mono text-foreground/80 transition-colors hover:border-beacon/40 hover:text-beacon"
              >
                {s.label}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
