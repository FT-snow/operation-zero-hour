"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

// Scroll-entry fade-up: 12px translate, 600ms, expo-ish ease. Transform/opacity only.
export function FadeIn({
  children,
  delay = 0,
  className = "",
  y = 12,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-24px 0px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Staggered container for lists/grids.
export function Stagger({
  children,
  className = "",
  step = 0.08,
}: {
  children: React.ReactNode[];
  className?: string;
  step?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-24px 0px" });

  return (
    <div ref={ref} className={className}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, delay: i * step, ease: [0.16, 1, 0.3, 1] }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
