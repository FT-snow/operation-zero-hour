"use client";

import React from "react";

// Last line of defense: any thrown error (Convex subscription error, render
// error, transport failure) is caught here and replaced with a quiet noir
// recovery screen. No stack traces, no technical text, no Convex internals.
type Props = { children: React.ReactNode };
type State = { failed: boolean };

class QuietBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: unknown) {
    // Intentionally silent. Technical detail never reaches the screen;
    // the session watchdog handles credential expiry separately.
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <p className="font-mono text-[10px] tracking-[0.3em] text-blood mb-3">
              SIGNAL INTERRUPTED
            </p>
            <p className="font-display text-3xl md:text-4xl mb-6">
              The line went dead.
            </p>
            <p className="font-mono text-xs text-mut leading-relaxed mb-10">
              Reconnect to the case file. Your team credentials remain yours.
            </p>
            <button
              onClick={() => window.location.replace("/")}
              className="bg-ink text-bg font-mono text-xs tracking-[0.2em] px-8 py-4 hover:bg-white transition-colors active:scale-[0.98]"
            >
              RECONNECT
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

export default QuietBoundary;
