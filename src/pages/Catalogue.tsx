import { useEffect, useState } from "react";
import { Loader2, Plus, Radar, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout, KeyPill, OutcomePill, useNarrow } from "@/components/Bits";
import {
  VersionCodeError, getApps, impactOf, publish, setChannel, setRollout, uploadVersion,
  type Impact,
} from "@/lib/api";
import {
  OUTCOME_LABEL, mb, shortDate,
  type AppVersion, type Channel, type ManagedApp, type Outcome, type SigningKey,
} from "@/lib/types";

export default function Catalogue() {
  const [apps, setApps] = useState<ManagedApp[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [adding, setAdding] = useState<ManagedApp | null>(null);

  const [draft, setDraft] = useState<Record<string, number>>({});
  const narrow = useNarrow();

  const pull = async () => setApps(await getApps());
  useEffect(() => { pull(); }, []);

  /**
   * Every control here is driven by data that only comes back a round trip later.
   * Without a local patch the control shows the old value until the write lands:
   * a tick that un-ticks itself, and a slider thumb that snaps back mid-drag.
   * So move the control now and let the write catch up behind it.
   */
  const patch = (versionId: string, fields: Partial<AppVersion>) =>
    setApps((prev) =>
      prev?.map((a) => ({
        ...a,
        versions: a.versions.map((v) => (v.id === versionId ? { ...v, ...fields } : v)),
      })) ?? prev,
    );

  const sorted = (app: ManagedApp) =>
    app.versions.slice().sort((a, b) => b.versionCode - a.versionCode);

  /** The drag is local; one write goes out when the thumb is let go. */
  const commitRollout = async (versionId: string) => {
    const next = draft[versionId];
    if (next === undefined) return;
    setBusy(versionId);
    try {
      await setRollout(versionId, next);
      await pull();
    } catch {
      toast.error("Could not change that rollout");
      await pull();
    } finally {
      setDraft(({ [versionId]: _drop, ...rest }) => rest);
      setBusy(null);
    }
  };

  const preflight = async (versionId: string) => {
    setChecking(versionId);
    try { setImpact(await impactOf(versionId)); }
    finally { setChecking(null); }
  };

  const channelSelect = (v: AppVersion) => (
    <select value={v.channel} aria-label={`Channel for ${v.versionName}`}
      data-testid={`channel-${v.id}`}
      onChange={async (e) => {
        const next = e.target.value as Channel;
        patch(v.id, { channel: next });
        setBusy(v.id);
        await setChannel(v.id, next);
        await pull();
        setBusy(null);
        toast.success(`Moved to ${next}`);
      }}
      className="h-9 rounded-sm border border-input bg-card px-2 text-sm">
      <option value="beta">beta</option>
      <option value="stable">stable</option>
    </select>
  );

  const rolloutControl = (v: AppVersion) => (
    <span className="flex items-center gap-2">
      <input type="range" min={0} max={100} step={5}
        value={draft[v.id] ?? v.rolloutPercent}
        disabled={!v.published} className="w-28"
        aria-label={`Rollout for ${v.versionName}`} data-testid={`rollout-${v.id}`}
        onChange={(e) => setDraft((d) => ({ ...d, [v.id]: Number(e.target.value) }))}
        onPointerUp={() => commitRollout(v.id)}
        onKeyUp={() => commitRollout(v.id)}
        onBlur={() => commitRollout(v.id)} />
      <span className="mono w-10 text-right text-xs">{draft[v.id] ?? v.rolloutPercent}%</span>
    </span>
  );

  const actions = (v: AppVersion, grow = "") => (
    <>
      <Button variant="outline" size="sm" className={`h-9 gap-1.5 ${grow}`}
        disabled={checking === v.id} data-testid={`preflight-${v.id}`}
        onClick={() => preflight(v.id)}>
        {checking === v.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden />
          : <Radar className="size-3.5" aria-hidden />} Dry run
      </Button>
      <Button variant={v.published ? "outline" : "default"} size="sm" className={`h-9 ${grow}`}
        disabled={busy === v.id} data-testid={`publish-${v.id}`}
        onClick={async () => {
          patch(v.id, {
            published: !v.published,
            // publish() starts a fresh version at 10%
            rolloutPercent: !v.published && v.rolloutPercent === 0 ? 10 : v.rolloutPercent,
          });
          setBusy(v.id);
          await publish(v.id, !v.published);
          await pull();
          setBusy(null);
          toast.success(v.published ? "Unpublished" : "Published at 10%");
        }}>
        {v.published ? "Unpublish" : "Publish"}
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Catalogue</h1>
        <p className="text-sm text-muted-foreground">
          Our own apps and their versions. Phase one ships only these; the shape allows third-party
          apps to be added later without changing the client.
        </p>
      </div>

      <Callout>
        Before turning a rollout up, run the dry run. It asks every phone in the fleet what it
        would do with that version at 100%, which is the only way to see a signing problem
        <strong> before</strong> families hit it. At 25% most phones just answer "not in the slice",
        and the real problem stays hidden.
      </Callout>

      {!apps ? (
        <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-40 rounded-sm" />)}</div>
      ) : (
        <div className="space-y-5" data-testid="catalogue">
          {apps.map((app) => (
            <section key={app.id} className="rounded-sm border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                <div>
                  <h2 className="font-semibold">{app.label}</h2>
                  <p className="mono text-sm text-muted-foreground">{app.packageName}</p>
                </div>
                <Button variant="outline" className="h-10 gap-2" data-testid={`add-${app.id}`} onClick={() => setAdding(app)}>
                  <Plus className="size-4" aria-hidden /> New version
                </Button>
              </div>

              {/* One set of controls, laid out as a row on a desk and a block on
                  a phone. The dry run is the point of this page, so it must not
                  end up behind a sideways scroll. */}
              {narrow ? (
                <ul className="divide-y divide-border" data-testid={`versions-${app.id}`}>
                  {sorted(app).map((v) => (
                    <li key={v.id} className={`space-y-2 px-3 py-3 ${v.published ? "" : "opacity-60"}`}
                      data-published={v.published} data-key={v.signedWith}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="mono text-sm">
                          {v.versionName}
                          <span className="block text-xs text-muted-foreground">
                            code {v.versionCode} · {mb(v.sizeBytes)} · {shortDate(v.uploadedAt)}
                          </span>
                        </span>
                        <KeyPill k={v.signedWith} />
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {channelSelect(v)}
                        {rolloutControl(v)}
                      </div>
                      <div className="flex gap-2">{actions(v, "flex-1")}</div>
                    </li>
                  ))}
                </ul>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-secondary text-left">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Version</th>
                      <th className="px-3 py-2 font-semibold">Signed</th>
                      <th className="px-3 py-2 font-semibold">Channel</th>
                      <th className="px-3 py-2 font-semibold">Rollout</th>
                      <th className="px-3 py-2 font-semibold">Uploaded</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody data-testid={`versions-${app.id}`}>
                    {sorted(app).map((v) => (
                      <tr key={v.id} className={`border-t border-border ${v.published ? "" : "opacity-60"}`}
                        data-published={v.published} data-key={v.signedWith}>
                        <td className="mono px-3 py-2.5">
                          {v.versionName}
                          <span className="block text-xs text-muted-foreground">
                            code {v.versionCode} · {mb(v.sizeBytes)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5"><KeyPill k={v.signedWith} /></td>
                        <td className="px-3 py-2.5">{channelSelect(v)}</td>
                        <td className="px-3 py-2.5">{rolloutControl(v)}</td>
                        <td className="mono px-3 py-2.5 whitespace-nowrap text-muted-foreground">{shortDate(v.uploadedAt)}</td>
                        <td className="px-3 py-2.5">
                          <span className="flex flex-wrap justify-end gap-1.5">{actions(v)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </section>
          ))}
        </div>
      )}

      <Dialog open={impact !== null} onOpenChange={(v) => !v && setImpact(null)}>
        <DialogContent className="sm:max-w-lg" data-testid="impact">
          <DialogHeader>
            <DialogTitle>Dry run</DialogTitle>
            <DialogDescription>
              {impact && (
                <>
                  {impact.app.packageName} {impact.version.versionName} at 100%, asked of every phone
                  in the fleet right now.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {impact && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-sm border border-good/40 bg-good/10 p-3">
                  <p className="mono text-2xl font-bold text-good" data-testid="would-install">{impact.wouldInstall}</p>
                  <p className="text-sm text-good">would install</p>
                </div>
                <div className="rounded-sm border border-stop/40 bg-stop/10 p-3">
                  <p className="mono text-2xl font-bold text-stop" data-testid="would-fail">{impact.wouldFail}</p>
                  <p className="text-sm text-stop">would not</p>
                </div>
              </div>

              <ul className="space-y-1.5" data-testid="impact-breakdown">
                {(Object.keys(OUTCOME_LABEL) as Outcome[])
                  .filter((o) => impact.outcomes[o] > 0)
                  .map((o) => (
                    <li key={o} className="flex items-center justify-between gap-3">
                      <OutcomePill o={o} />
                      <span className="mono text-sm">{impact.outcomes[o]}</span>
                    </li>
                  ))}
              </ul>

              {impact.outcomes.signature_mismatch > 0 && (
                <p className="flex items-start gap-2 rounded-sm border border-stop/40 bg-stop/5 p-3 text-sm leading-relaxed">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-stop" aria-hidden />
                  <span>
                    {impact.outcomes.signature_mismatch} phones are running a build signed with a
                    different key. Android will not update across a key change: those phones need an
                    uninstall and a fresh install, and they lose their app data. That is a migration
                    with the families, not a release.
                  </span>
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <NewVersionDialog app={adding} close={() => setAdding(null)} done={async () => { setAdding(null); await pull(); }} />
    </div>
  );
}

function NewVersionDialog({ app, close, done }: { app: ManagedApp | null; close: () => void; done: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [key, setKey] = useState<SigningKey>("release");
  const [channel, setChan] = useState<Channel>("beta");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!app) return;
    const highest = Math.max(0, ...app.versions.map((v) => v.versionCode));
    setCode(String(highest + 1));
    setName(""); setNotes(""); setError(null);
  }, [app]);

  return (
    <Dialog open={app !== null} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New version</DialogTitle>
          <DialogDescription>
            {app && <>Upload a build of <span className="mono">{app.packageName}</span>. It arrives unpublished, at 0%.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="vname">Version name</Label>
            <Input id="vname" value={name} onChange={(e) => setName(e.target.value)} placeholder="1.7.0"
              className="h-11" data-testid="field-name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vcode">versionCode</Label>
            <Input id="vcode" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric"
              className="mono h-11" data-testid="field-code" />
            <p className="text-xs text-muted-foreground">
              Must be above every code already in the catalogue. Android refuses to install a lower
              code over a higher one, so the server refuses it too.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vkey">Signed with</Label>
              <select id="vkey" value={key} onChange={(e) => setKey(e.target.value as SigningKey)}
                data-testid="field-key" className="h-11 w-full rounded-sm border border-input bg-card px-2 text-sm">
                <option value="release">release</option>
                <option value="debug">debug</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vchan">Channel</Label>
              <select id="vchan" value={channel} onChange={(e) => setChan(e.target.value as Channel)}
                data-testid="field-channel" className="h-11 w-full rounded-sm border border-input bg-card px-2 text-sm">
                <option value="beta">beta</option>
                <option value="stable">stable</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vnotes">Notes</Label>
            <Input id="vnotes" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-11" data-testid="field-notes" />
          </div>

          {error && <p className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert" data-testid="upload-error">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button className="h-11 sm:flex-1" disabled={saving || !app || !name.trim()} data-testid="upload"
              onClick={async () => {
                if (!app) return;
                setSaving(true); setError(null);
                try {
                  await uploadVersion({ appId: app.id, versionName: name, versionCode: Number(code), signedWith: key, channel, notes });
                  toast.success("Uploaded. Not published yet.");
                  done();
                } catch (e) {
                  setError(e instanceof VersionCodeError ? e.message : e instanceof Error ? e.message : "Could not upload");
                } finally { setSaving(false); }
              }}>
              {saving ? "Uploading…" : "Upload"}
            </Button>
            <Button variant="outline" className="h-11 sm:flex-1" onClick={close}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
