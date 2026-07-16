import * as React from 'react';
import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';

export default function NotFound(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-24">
        <div className="glass max-w-md rounded-2xl p-10 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-border bg-surface-2 text-beacon">
            <Compass className="size-6" />
          </div>
          <p className="mt-5 font-mono text-sm text-beacon">404</p>
          <h1 className="mt-1 text-xl font-semibold text-foreground">
            Off the map
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The page you are looking for does not exist. Let Beacon guide you
            back.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/">
              <Button variant="primary" size="sm">
                Return home
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="secondary" size="sm">
                Open dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
