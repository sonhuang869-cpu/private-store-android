import { useEffect, useState, type ReactNode } from "react";
import { Check, CircleDot, OctagonX } from "lucide-react";
import { OUTCOME_LABEL, OUTCOME_TONE, type Outcome, type SigningKey } from "@/lib/types";

const TONE = {
  ok: "border-good/40 bg-good/10 text-good",
  idle: "border-border bg-secondary text-muted-foreground",
  blocked: "border-stop/40 bg-stop/10 text-stop",
} as const;

const ICON = { ok: Check, idle: CircleDot, blocked: OctagonX };

export function OutcomePill({ o }: { o: Outcome }) {
  const tone = OUTCOME_TONE[o];
  const I = ICON[tone];
  return (
    <span data-outcome={o} data-tone={tone}
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}>
      <I className="size-3.5 shrink-0" aria-hidden /> {OUTCOME_LABEL[o]}
    </span>
  );
}

export function KeyPill({ k }: { k: SigningKey }) {
  return (
    <span data-key={k}
      className={`mono inline-flex items-center rounded-sm border px-1.5 py-0.5 text-xs ${
        k === "release" ? "border-good/40 bg-good/10 text-good" : "border-warn/40 bg-warn/10 text-warn"
      }`}>
      {k}
    </span>
  );
}

export function Stat({ label, value, note, tone = "" }: { label: string; value: string; note?: ReactNode; tone?: string }) {
  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mono mt-0.5 text-2xl font-bold ${tone}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return <div className="rounded-sm border-l-2 border-primary bg-accent/40 px-4 py-3 text-sm leading-relaxed">{children}</div>;
}

/**
 * Below md the tables become cards. Rendering both and hiding one with CSS would
 * put two copies of every control in the DOM, each with the same label; this
 * renders one.
 */
export function useNarrow(): boolean {
  const query = "(max-width: 767px)";
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
}
