'use client';

import * as React from 'react';
import { Download, Github, Star } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { ScoreRing } from '@/components/ui/score-ring';
import { ProgressBar } from '@/components/ui/progress-bar';
import { ChartCard } from '@/components/ui/chart-card';
import { Skeleton } from '@/components/ui/skeleton';

/** Living style guide for the Beacon UI primitives. */
export default function ComponentsPage(): React.JSX.Element {
  const [count, setCount] = React.useState(0);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="aurora" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <Badge variant="beacon" className="mb-3">
              Style guide
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">UI kit</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              The reusable primitives that compose the Beacon dashboard — real and interactive,
              exactly as they ship.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-7xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
          <Section title="Button" description="cva variants and sizes.">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="primary">
                <Download className="size-4" />
                With icon
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button variant="secondary" onClick={() => setCount((c) => c + 1)}>
                Clicked {count} time{count === 1 ? '' : 's'}
              </Button>
              <Button disabled>Disabled</Button>
            </div>
          </Section>

          <Section title="Badge" description="Status and category chips.">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Default</Badge>
              <Badge variant="beacon">Beacon</Badge>
              <Badge variant="cyan">Cyan</Badge>
              <Badge variant="success">Excellent</Badge>
              <Badge variant="warning">At risk</Badge>
              <Badge variant="danger">Critical</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </Section>

          <Section title="Card" description="The base glass surface.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Card title</CardTitle>
                  <CardDescription>
                    A translucent, frosted surface used throughout the app.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Cards compose a header, title, description, and content.
                  </p>
                </CardContent>
              </Card>
              <Card hover>
                <CardHeader>
                  <CardTitle>Hover card</CardTitle>
                  <CardDescription>Lifts and glows on hover.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Pass <code className="font-mono text-beacon">hover</code> to enable the
                    interactive lift.
                  </p>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section title="StatCard" description="Compact metric tiles with trend chips.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Stars" value="18.4k" icon={Star} delta={12} />
              <StatCard label="Forks" value="921" icon={Github} delta={-4} />
              <StatCard
                label="Median close"
                value="2.6d"
                delta={-8}
                invertDelta
                hint="Lower is better"
              />
              <StatCard label="Contributors" value="34" delta={3} />
            </div>
          </Section>

          <Section title="ScoreRing" description="Animated circular progress.">
            <div className="flex flex-wrap items-center gap-8">
              <ScoreRing value={92} label="Excellent" />
              <ScoreRing value={68} size={130} label="Fair" />
              <ScoreRing value={38} size={100} strokeWidth={8} label="At risk" />
            </div>
          </Section>

          <Section title="ProgressBar" description="Animated horizontal bars.">
            <div className="max-w-md space-y-4">
              <ProgressBar value={88} label="Activity" valueLabel="88" />
              <ProgressBar value={64} label="Community" valueLabel="64" color="hsl(190 95% 55%)" />
              <ProgressBar value={42} label="Maintenance" valueLabel="42" color="hsl(38 92% 55%)" />
            </div>
          </Section>

          <Section title="ChartCard" description="Titled wrapper for charts and data.">
            <div className="max-w-xl">
              <ChartCard
                title="Chart card"
                description="Wraps any visualization with a titled header"
                icon={<Star className="size-4" />}
              >
                <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
                  Chart content goes here
                </div>
              </ChartCard>
            </div>
          </Section>

          <Section title="Skeleton" description="Loading placeholders.">
            <div className="max-w-md space-y-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex gap-3 pt-2">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            </div>
          </Section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section>
      <div className="mb-4 border-b border-border/60 pb-3">
        <h2 className="font-mono text-sm font-semibold text-beacon">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
