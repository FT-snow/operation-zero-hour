"use client";

import { useEffect, useRef, useState } from "react";

// Typewriter effect: reveals text char by char with a blinking cursor block.
export default function Typewriter({
  text,
  className = "",
  speed = 45,
  startDelay = 0,
  mono = true,
}: {
  text: string;
  className?: string;
  speed?: number;
  startDelay?: number;
  mono?: boolean;
}) {
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let i = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      i += 1;
      setShown(i);
      if (i >= text.length) {
        setDone(true);
        return;
      }
      // slight jitter for human feel
      const jitter = text[i - 1] === " " ? speed * 2 : speed;
      timeout.current = setTimeout(tick, jitter);
    };
    const start = setTimeout(tick, startDelay);
    return () => {
      cancelled = true;
      clearTimeout(start);
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [text, speed, startDelay]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">
        {text.slice(0, shown)}
        <span
          className={`blink inline-block w-[0.6ch] bg-current align-baseline ${
            mono ? "font-mono" : ""
          }`}
          style={{ height: "0.9em", opacity: done ? 0 : 1, visibility: done ? "hidden" : "visible" }}
        />
      </span>
    </span>
  );
}
