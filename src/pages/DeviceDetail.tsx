import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout, KeyPill, OutcomePill } from "@/components/Bits";
import type { Decision } from "@/lib/checkin";
import { getDevices, runCheckIn, setDeviceChannel, setDeviceFlag } from "@/lib/api";
import { shortDate, type Channel, type Device } from "@/lib/types";
import NotFound from "@/pages/NotFound";

const TONE = { ok: "border-l-good", idle: "border-l-border", blocked: "border-l-stop" } as const;
const TEXT = { ok: "", idle: "text-muted-foreground", blocked: "text-stop" } as const;

export default function DeviceDetail() {
  const { id = "" } = useParams();
  const [device, setDevice] = useState<Device | null | "loading">("loading");
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [running, setRunning] = useState(false);

  const pull = async () => setDevice((await getDevices()).find((d) => d.id === id) ?? null);
  useEffect(() => { pull(); }, [id]);

  if (device === "loading")
    return <div className="space-y-4"><Skeleton className="h-8 w-56" /><Skeleton className="h-64 w-full rounded-sm" /></div>;
  if (!device) return <NotFound />;

  /**
   * Move the tick on the click, not when the write lands. These are controlled
   * by data that arrives a round trip later, so without the local set the
   * checkbox shows the old state for a second and invites a second click.
   */
  const flag = async (f: "deviceOwner" | "batteryUnrestricted", v: boolean) => {
    setDevice({ ...device, [f]: v });
    setDecisions(null);
    try { await setDeviceFlag(device.id, f, v); }
    catch { toast.error("Could not change that"); }
    await pull();
  };

  return (
    <div className="space-y-5">
      <Link to="/devices" className="-ml-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Back to devices
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{device.family}</h1>
        <p className="mono text-sm text-muted-foreground">
          {device.serial} · {device.model} · Android {device.androidVersion}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4">
          <section className="rounded-sm border border-border bg-card p-4">
            <h2 className="font-semibold">State</h2>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Channel</dt>
                <dd>
                  <select value={device.channel} aria-label="Channel" data-testid="channel"
                    onChange={async (e) => {
                      const next = e.target.value as Channel;
                      setDevice({ ...device, channel: next });
                      setDecisions(null);
                      await setDeviceChannel(device.id, next);
                      await pull();
                    }}
                    className="mono h-8 rounded-sm border border-input bg-card px-1.5 text-sm">
                    <option value="beta">beta</option>
                    <option value="stable">stable</option>
                  </select>
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Installed builds signed with</dt>
                <dd><KeyPill k={device.installedWith} /></dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Last check-in</dt>
                <dd className="mono">{shortDate(device.lastCheckIn)}</dd>
              </div>
            </dl>

            <h3 className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Installed</h3>
            <ul className="mono mt-1.5 space-y-0.5 text-xs" data-testid="installed">
              {Object.entries(device.installed).map(([pkg, code]) => (
                <li key={pkg} className="flex justify-between gap-2">
                  <span className="truncate text-muted-foreground">{pkg}</span>
                  <span>{code}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-sm border border-border bg-card p-4">
            <h2 className="font-semibold">Preconditions</h2>
            <p className="text-sm text-muted-foreground">Turn one off and run the check-in again.</p>
            <label className="mt-3 flex min-h-11 items-center justify-between gap-3 text-sm">
              <span>
                Device owner
                <span className="block text-xs text-muted-foreground">without it, no silent install</span>
              </span>
              <input type="checkbox" checked={device.deviceOwner} data-testid="owner" className="size-6"
                onChange={(e) => flag("deviceOwner", e.target.checked)} />
            </label>
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
              <span>
                Battery unrestricted
                <span className="block text-xs text-muted-foreground">Samsung sleeps unused apps</span>
              </span>
              <input type="checkbox" checked={device.batteryUnrestricted} data-testid="battery" className="size-6"
                onChange={(e) => flag("batteryUnrestricted", e.target.checked)} />
            </label>
          </section>

          <Button className="h-12 w-full gap-2" disabled={running} data-testid="run"
            onClick={async () => {
              setRunning(true);
              try {
                const d = await runCheckIn(device.id);
                setDecisions(d);
                await pull();
                const installed = d.filter((x) => x.outcome === "installed").length;
                toast[installed ? "success" : "info"](
                  installed ? `${installed} app${installed === 1 ? "" : "s"} installed` : "Nothing installed",
                );
              } finally { setRunning(false); }
            }}>
            {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PlayCircle className="size-5" aria-hidden />}
            Run check-in
          </Button>
        </div>

        <section className="rounded-sm border border-border bg-card p-4">
          <h2 className="font-semibold">What the phone did</h2>
          {!decisions ? (
            <div className="mt-3">
              <Callout>
                Press run. The trace shows every step the client takes, in order, and which one
                stops it. Every refusal below happens on the phone, not on the server: a server
                that has been tampered with must not be able to talk a phone into installing
                something it should refuse.
              </Callout>
            </div>
          ) : (
            <ul className="mt-3 space-y-4" data-testid="decisions">
              {decisions.map((d) => (
                <li key={d.app.id} data-outcome={d.outcome}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="mono text-sm font-medium">{d.app.packageName}</span>
                    <OutcomePill o={d.outcome} />
                  </div>
                  <ol className="rail mt-2 space-y-1.5">
                    {d.steps.map((s, i) => (
                      <li key={i} data-tone={s.tone}
                        className={`relative border-l-2 pl-3 text-sm ${TONE[s.tone]}`}>
                        <span className="absolute top-1.5 -left-[7px] size-3 rounded-full border-2 border-background"
                          style={{ background: s.tone === "ok" ? "var(--good)" : s.tone === "blocked" ? "var(--stop)" : "var(--idle)" }}
                          aria-hidden />
                        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{s.label}</span>
                        <span className={`block leading-relaxed ${TEXT[s.tone]}`}>{s.detail}</span>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
