'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Github } from 'lucide-react';
import { BeaconLogo } from '@/components/beacon-logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/components', label: 'UI Kit' },
];

const GITHUB_URL = 'https://github.com/martin-k-m/beacon';

/** Sticky, glass top navigation shared across the app. */
export function Navbar(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-90"
          aria-label="Beacon home"
        >
          <BeaconLogo size={26} withWordmark />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {link.label}
                {active && (
                  <span className="mx-3 block h-px bg-gradient-to-r from-transparent via-beacon to-transparent" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Beacon on GitHub"
          >
            <Button variant="ghost" size="icon">
              <Github className="size-5" />
            </Button>
          </a>
          <Link href="/dashboard" className="hidden sm:inline-flex">
            <Button variant="secondary" size="sm">
              Open dashboard
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
