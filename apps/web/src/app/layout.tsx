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
    default: 'Beacon — GitHub repository intelligence',
    template: '%s · Beacon',
  },
  description:
    'Understand any GitHub repository instantly. Health scores, activity, contributor analytics, and AI summaries in one dashboard.',
  keywords: [
    'github',
    'repository intelligence',
    'open source health',
    'developer analytics',
    'beacon score',
  ],
  authors: [{ name: 'Beacon' }],
  openGraph: {
    title: 'Beacon — GitHub repository intelligence',
    description:
      'Health scores, activity, contributor analytics, and AI summaries for any GitHub repository.',
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
