import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://beacon.blinkdev.me'),
  title: {
    default: 'Beacon Analytics — repository health trends',
    template: '%s · Beacon Analytics',
  },
  description:
    'Track how the Beacon Score and five health pillars of any GitHub repository move over time — with historical trend charts and per-pillar deltas.',
  keywords: [
    'github',
    'repository intelligence',
    'open source health',
    'health trends',
    'developer analytics',
    'beacon score',
  ],
  authors: [{ name: 'Beacon' }],
  openGraph: {
    title: 'Beacon Analytics — repository health trends',
    description:
      'Historical health trend charts, per-pillar deltas, and AI summaries for any GitHub repository.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={cn(
          inter.variable,
          jetbrainsMono.variable,
          'min-h-screen bg-background font-sans antialiased',
        )}
      >
        {children}
      </body>
    </html>
  );
}
