import * as React from 'react';
import {
  Boxes,
  GaugeCircle,
  GitBranch,
  Sparkles,
  Terminal,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Reveal } from '@/components/reveal';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: GitBranch,
    title: 'Repository intelligence',
    description:
      'A single snapshot of any repo — metadata, activity, releases, and dependencies collected and normalized.',
  },
  {
    icon: GaugeCircle,
    title: 'Health scores',
    description:
      'A deterministic 0–100 Beacon Score across five weighted pillars, so you can compare projects at a glance.',
  },
  {
    icon: Users,
    title: 'Contributor analytics',
    description:
      'See who carries the project, how contributions are distributed, and where the bus-factor risk lives.',
  },
  {
    icon: Sparkles,
    title: 'AI summaries',
    description:
      'A natural-language read on repository health — with an offline heuristic fallback that needs no API key.',
  },
  {
    icon: Boxes,
    title: 'Dependency insights',
    description:
      'Ecosystem manifests, security policy, and Dependabot signals folded into a supply-chain hygiene score.',
  },
  {
    icon: Terminal,
    title: 'CLI & API',
    description:
      'The same engine behind this dashboard ships as a typed core package, an HTTP API, and a command line.',
  },
];

/** The landing-page features grid, revealed on scroll with hover glow. */
export function FeatureGrid(): React.JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((feature, i) => {
        const Icon = feature.icon;
        return (
          <Reveal key={feature.title} index={i}>
            <div className="glass card-hover group h-full rounded-lg p-6">
              <div className="flex size-11 items-center justify-center rounded-lg border border-border bg-surface-2 text-beacon transition-colors group-hover:border-beacon/40 group-hover:bg-beacon/10">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
