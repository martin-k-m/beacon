/**
 * @beacon/ui — shared React UI primitives for Beacon's apps (dashboard + web).
 *
 * These are presentational components styled with Tailwind design tokens
 * (`beacon`, `surface`, `success`, …) and CSS variables that the consuming app
 * must define in its `globals.css` and `tailwind.config`. The app is also
 * responsible for `transpilePackages: ['@beacon/ui']` and including this
 * package's `src` in its Tailwind `content` globs.
 */
export * from './utils';
export * from './button';
export * from './badge';
export * from './card';
export * from './score-ring';
export * from './progress-bar';
export * from './stat-card';
export * from './chart-card';
export * from './skeleton';
