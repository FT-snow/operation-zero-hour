// Small free-standing status pill. No emoji, tiny mono uppercase text.

const STYLES: Record<string, string> = {
  not_started: "text-mut border-line",
  going_on: "text-amber border-amber/40",
  live: "text-blood border-blood/50",
  closed: "text-mut border-line",
  ended: "text-mut border-line",
  cleared: "text-sage border-sage/40",
};

export function statusLabel(status: string, roundNumber: number): string {
  switch (status) {
    case "not_started":
      return "NOT STARTED";
    case "live":
      return roundNumber <= 2 ? "GOING ON" : "LIVE";
    case "closed":
      return roundNumber <= 2 ? "ENDED" : "CLOSED";
    default:
      return status.toUpperCase();
  }
}

export default function StatusBadge({
  status,
  roundNumber = 0,
  pulse = false,
}: {
  status: string;
  roundNumber?: number;
  pulse?: boolean;
}) {
  const cls = STYLES[status === "live" && roundNumber <= 2 ? "going_on" : status] ?? STYLES.not_started;
  return (
    <span
      className={`inline-flex items-center gap-2 border px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] ${cls}`}
    >
      {status === "live" && (
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${roundNumber <= 2 ? "bg-amber" : "bg-blood"} ${
            pulse ? "dot-live" : ""
          }`}
        />
      )}
      {statusLabel(status, roundNumber)}
    </span>
  );
}
