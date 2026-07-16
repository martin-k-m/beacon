/**
 * A tiny, dependency-free terminal spinner.
 *
 * It animates a set of braille frames on a single line while a long-running
 * task is in flight, then clears the line and (optionally) prints a final
 * message. When stderr is not a TTY (e.g. piped to a file or CI logs) it
 * degrades to a no-op so we never emit stray control characters.
 */

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;
const INTERVAL_MS = 80;

export interface SpinnerOptions {
  /** Stream to render to. Defaults to `process.stderr`. */
  stream?: NodeJS.WriteStream;
  /** Force-disable animation (e.g. when color/interactivity is off). */
  enabled?: boolean;
}

export class Spinner {
  private readonly stream: NodeJS.WriteStream;
  private readonly enabled: boolean;
  private timer: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private text = '';

  constructor(options: SpinnerOptions = {}) {
    this.stream = options.stream ?? process.stderr;
    const isTty = Boolean(this.stream.isTTY);
    this.enabled = options.enabled ?? isTty;
  }

  /** Begin animating with the given label. Safe to call when disabled. */
  start(text: string): this {
    this.text = text;
    if (!this.enabled) {
      return this;
    }
    if (this.timer) {
      return this;
    }
    this.hideCursor();
    this.render();
    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % FRAMES.length;
      this.render();
    }, INTERVAL_MS);
    // Do not keep the event loop alive solely for the spinner.
    this.timer.unref?.();
    return this;
  }

  /** Update the label without interrupting the animation. */
  setText(text: string): this {
    this.text = text;
    if (this.enabled && this.timer) {
      this.render();
    }
    return this;
  }

  /** Stop animating, clear the line, and optionally print a final message. */
  stop(finalText?: string): this {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.enabled) {
      this.clearLine();
      this.showCursor();
    }
    if (finalText !== undefined && finalText.length > 0) {
      this.stream.write(`${finalText}\n`);
    }
    return this;
  }

  private render(): void {
    const frame = FRAMES[this.frameIndex] ?? FRAMES[0];
    this.clearLine();
    this.stream.write(`${frame} ${this.text}`);
  }

  private clearLine(): void {
    this.stream.write('\r[2K');
  }

  private hideCursor(): void {
    this.stream.write('[?25l');
  }

  private showCursor(): void {
    this.stream.write('[?25h');
  }
}

/** Convenience factory mirroring the constructor. */
export function createSpinner(options: SpinnerOptions = {}): Spinner {
  return new Spinner(options);
}
