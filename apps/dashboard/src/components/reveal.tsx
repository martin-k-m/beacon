'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

export interface RevealProps extends HTMLMotionProps<'div'> {
  /** Stagger index — multiplies the base delay. */
  index?: number;
  /** Base delay in seconds. */
  delay?: number;
  /** Vertical travel distance in px. */
  y?: number;
}

/**
 * Scroll-reveal wrapper: fades and slides its children into view once, when
 * they enter the viewport.
 */
export function Reveal({
  index = 0,
  delay = 0,
  y = 16,
  children,
  ...props
}: RevealProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{
        duration: 0.6,
        delay: delay + index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
