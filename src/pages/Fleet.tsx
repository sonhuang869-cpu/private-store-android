import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BatteryWarning, KeyRound, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout, OutcomePill, Stat } from "@/components/Bits";
import { getSummary, type FleetSummary } from "@/lib/api";
import { OUTCOME_LABEL, type Outcome } from "@/lib/types";

export default function Fleet() {
  const [s, setS] = useState<FleetSummary | null>(null);
  useEffect(() => { let a = true; getSummary().then((x) => a && setS(x)); return () => { a = false; }; }, []);

  if (!s)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-sm" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-sm" />
      </div>
    );

  const outcomes = (Object.keys(OUTCOME_LABEL) as Outcome[])
    .map((o) => ({ o, n: s.outcomes[o] })).filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fleet</h1>
        <p className="text-sm text-muted-foreground">
          {s.devices} managed phones in the beta. What would happen if they all checked in now.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Checked in today" value={`${s.checkedInToday}/${s.devices}`} note="phones that reached the server" />
        <Stat label="Without device owner" value={String(s.withoutDeviceOwner)}
          tone={s.withoutDeviceOwner ? "text-stop" : "text-good"} note="cannot install silently" />
        <Stat label="Store app asleep" value={String(s.asleep)}
          tone={s.asleep ? "text-stop" : "text-good"} note="never checks in at all" />
        <Stat label="On debug builds" value={`${s.onDebugBuilds}/${s.devices}`}
          tone={s.onDebugBuilds ? "text-warn" : "text-good"} note="will break on the release key" />
      </div>

      <Callout>
        Three of these numbers are the whole of phase one. A phone without device owner cannot be
        updated silently; a phone whose store app is asleep never asks; and a phone on a debug
        build cannot be updated by a release-signed APK at all. The first two are provisioning,
        the third is a migration.
      </Callout>

      <section className="rounded-sm border border-border bg-card p-4">
        <h2 className="font-semibold">If every phone checked in right now</h2>
        <p className="text-sm text-muted-foreground">
          One outcome per phone, per app, using the catalogue as it stands.
        </p>
        <ul className="mt-3 space-y-2" data-testid="outcomes">
          {outcomes.map(({ o, n }) => (
            <li key={o} className="flex items-center gap-3">
              <span className="w-56 shrink-0"><OutcomePill o={o} /></span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <span className="block h-full rounded-full bg-primary"
                  style={{ width: `${Math.round((n / (s.devices * s.perApp.length)) * 100)}%` }} aria-hidden />
              </span>
              <span className="mono w-10 shrink-0 text-right text-sm">{n}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-sm border border-border bg-card p-4">
        <h2 className="font-semibold">Apps</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Package</th>
                <th className="px-3 py-2 font-semibold">Latest on stable</th>
                <th className="px-3 py-2 font-semibold">Fleet on latest</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody data-testid="apps">
              {s.perApp.map((p) => (
                <tr key={p.app.id} className="border-t border-border">
                  <td className="mono px-3 py-2.5">{p.app.packageName}</td>
                  <td className="mono px-3 py-2.5">
                    {p.latest ? `${p.latest.versionName} (${p.latest.versionCode})` : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
                        <span className="block h-full rounded-full bg-good"
                          style={{ width: `${Math.round((p.onLatest / p.total) * 100)}%` }} aria-hidden />
                      </span>
                      <span className="mono text-xs">{p.onLatest}/{p.total}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link to="/apps" className="inline-flex min-h-9 items-center text-sm text-primary hover:underline">
                      versions
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/devices" className="flex items-start gap-3 rounded-sm border border-border bg-card p-4 hover:bg-secondary/60">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-stop" aria-hidden />
          <span>
            <span className="block font-medium">Device owner</span>
            <span className="block text-sm text-muted-foreground">
              See a phone fail without it, and succeed with it.
            </span>
          </span>
        </Link>
        <Link to="/apps" className="flex items-start gap-3 rounded-sm border border-border bg-card p-4 hover:bg-secondary/60">
          <KeyRound className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
          <span>
            <span className="block font-medium">Signing keys</span>
            <span className="block text-sm text-muted-foreground">
              Check the release build against the fleet before publishing it.
            </span>
          </span>
        </Link>
        <Link to="/notes" className="flex items-start gap-3 rounded-sm border border-border bg-card p-4 hover:bg-secondary/60">
          <BatteryWarning className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
          <span>
            <span className="block font-medium">Samsung specifics</span>
            <span className="block text-sm text-muted-foreground">
              Why two phones have not checked in for days.
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
