import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { KeyPill, useNarrow } from "@/components/Bits";
import { getDevices } from "@/lib/api";
import { daysBetween, shortDate, today, type Device } from "@/lib/types";

export default function Devices() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [q, setQ] = useState("");
  const narrow = useNarrow();

  useEffect(() => { let a = true; getDevices().then((d) => a && setDevices(d)); return () => { a = false; }; }, []);

  const visible = (devices ?? []).filter((d) =>
    !q.trim() || `${d.family} ${d.serial} ${d.model}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Devices</h1>
        <p className="text-sm text-muted-foreground">
          The beta fleet. Open one to run a check-in and watch the decision step by step.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} className="h-11 pl-9"
          placeholder="Search by family, serial or model" aria-label="Search devices" data-testid="search" />
      </div>

      {!devices ? (
        <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-14 rounded-sm" />)}</div>
      ) : visible.length === 0 ? (
        <p className="rounded-sm border border-dashed border-border p-8 text-center text-sm text-muted-foreground" data-testid="empty">
          No device matches that.
        </p>
      ) : (
        /* On a phone the seven columns would push device owner and sleep off
           screen, and those two are the whole point of this list. */
        narrow ? (
        <ul className="space-y-2" data-testid="device-cards">
          {visible.map((d) => {
            const stale = daysBetween(d.lastCheckIn, today());
            return (
              <li key={d.id}>
                <Link to={`/device/${d.id}`}
                  className="block rounded-sm border border-border bg-card p-3 hover:border-primary">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-primary">{d.family}</span>
                    <span className="mono text-xs text-muted-foreground">{d.channel}</span>
                  </span>
                  <span className="mono block text-xs text-muted-foreground">
                    {d.serial} · {d.model} · A{d.androidVersion}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {d.deviceOwner
                      ? <span className="text-good">device owner</span>
                      : <span className="font-medium text-stop">no device owner</span>}
                    {d.batteryUnrestricted
                      ? <span className="text-muted-foreground">unrestricted</span>
                      : <span className="font-medium text-stop">asleep</span>}
                    <KeyPill k={d.installedWith} />
                    <span className={stale > 2 ? "mono text-stop" : "mono text-muted-foreground"}>
                      {stale > 2 ? `${stale} days ago` : shortDate(d.lastCheckIn)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        ) : (
        <div className="overflow-x-auto rounded-sm border border-border">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Family</th>
                <th className="px-3 py-2 font-semibold">Model</th>
                <th className="px-3 py-2 font-semibold">Channel</th>
                <th className="px-3 py-2 font-semibold">Device owner</th>
                <th className="px-3 py-2 font-semibold">Store app</th>
                <th className="px-3 py-2 font-semibold">Signed with</th>
                <th className="px-3 py-2 font-semibold">Last check-in</th>
              </tr>
            </thead>
            <tbody data-testid="devices">
              {visible.map((d) => {
                const stale = daysBetween(d.lastCheckIn, today());
                return (
                  <tr key={d.id} className="border-t border-border"
                    data-owner={d.deviceOwner} data-awake={d.batteryUnrestricted}>
                    <td className="px-3 py-1.5">
                      {/* the whole two-line block is the target, so it clears a thumb */}
                      <Link to={`/device/${d.id}`} className="-mx-1 flex min-h-11 flex-col justify-center rounded-sm px-1 hover:bg-secondary">
                        <span className="font-medium text-primary">{d.family}</span>
                        <span className="mono text-xs text-muted-foreground">{d.serial}</span>
                      </Link>
                    </td>
                    <td className="mono px-3 py-2.5 text-muted-foreground">{d.model} · A{d.androidVersion}</td>
                    <td className="mono px-3 py-2.5">{d.channel}</td>
                    <td className="px-3 py-2.5">
                      {d.deviceOwner
                        ? <span className="text-good">yes</span>
                        : <span className="font-medium text-stop">no</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {d.batteryUnrestricted
                        ? <span className="text-muted-foreground">unrestricted</span>
                        : <span className="font-medium text-stop">asleep</span>}
                    </td>
                    <td className="px-3 py-2.5"><KeyPill k={d.installedWith} /></td>
                    <td className="mono px-3 py-2.5 whitespace-nowrap">
                      {shortDate(d.lastCheckIn)}
                      {stale > 2 && <span className="block text-xs text-stop">{stale} days ago</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )
      )}
    </div>
  );
}
