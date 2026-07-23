import * as React from 'react';
import Link from 'next/link';
import { BeaconLogo } from '@/components/beacon-logo';

const GITHUB_URL = 'https://github.com/martin-k-m/beacon';
const BLINK_URL = 'https://blinkdev.me';

/** Global footer with project links and ecosystem attribution. */
export function Footer(): React.JSX.Element {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <BeaconLogo size={24} withWordmark />
            <p className="mt-3 text-sm text-muted-foreground">
              Open-source GitHub repository intelligence. Health scores, contributor analytics, and
              AI summaries for any repository.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterColumn title="Product">
              <FooterLink href="/dashboard">Dashboard</FooterLink>
              <FooterLink href="/components">UI Kit</FooterLink>
              <FooterLink href="/dashboard/beacon-labs/aurora">Demo analysis</FooterLink>
            </FooterColumn>
            <FooterColumn title="Resources">
              <FooterExternal href={GITHUB_URL}>GitHub</FooterExternal>
              <FooterExternal href={`${GITHUB_URL}#readme`}>Docs</FooterExternal>
              <FooterExternal href={`${GITHUB_URL}/blob/main/LICENSE`}>MIT License</FooterExternal>
            </FooterColumn>
            <FooterColumn title="Ecosystem">
              <FooterExternal href={BLINK_URL}>Blink Dev</FooterExternal>
              <FooterExternal href={`${GITHUB_URL}/issues`}>Issues</FooterExternal>
            </FooterColumn>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>
            &copy; {year} Beacon. Released under the{' '}
            <a
              href={`${GITHUB_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noreferrer"
              className="text-foreground/80 underline-offset-2 hover:text-beacon hover:underline"
            >
              MIT License
            </a>
            .
          </p>
          <p>
            Part of the{' '}
            <a
              href={BLINK_URL}
              target="_blank"
              rel="noreferrer"
              className="text-foreground/80 underline-offset-2 hover:text-beacon hover:underline"
            >
              Blink Dev
            </a>{' '}
            ecosystem.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/70">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <li>
      <Link href={href} className="text-muted-foreground transition-colors hover:text-foreground">
        {children}
      </Link>
    </li>
  );
}

function FooterExternal({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        {children}
      </a>
    </li>
  );
}
