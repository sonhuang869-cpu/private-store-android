/**
 * Mock API. The console talks to it as if it were the Node server; swapping it
 * for the real one means editing this file only.
 */
import { checkIn, simulateFleet, type Decision } from "./checkin";
import { generate, type Data } from "./seed";
import {
  latestFor, today,
  type AppVersion, type Channel, type Device, type ManagedApp, type Outcome, type SigningKey,
} from "./types";

const K = "store:data:v1";
const wait = (ms?: number) => new Promise((r) => setTimeout(r, ms ?? 180 + Math.random() * 300));

function read(): Data {
  try {
    const raw = localStorage.getItem(K);
    if (raw) { const d = JSON.parse(raw) as Data; if (d?.apps?.length) return d; }
  } catch { /* private window */ }
  const fresh = generate();
  write(fresh);
  return fresh;
}
function write(d: Data) {
  try { localStorage.setItem(K, JSON.stringify(d)); } catch { /* no space */ }
}

export class VersionCodeError extends Error {
  constructor(code: number, highest: number) {
    super(`versionCode ${code} is not above ${highest}. Android refuses to install a lower code over a higher one, so the catalogue refuses it too.`);
  }
}
export class RolloutError extends Error {
  constructor() { super("Rollout must be between 0 and 100."); }
}

export async function getApps(): Promise<ManagedApp[]> {
  await wait();
  return read().apps;
}

export async function getDevices(): Promise<Device[]> {
  await wait();
  return read().devices;
}

export interface NewVersion {
  appId: string;
  versionName: string;
  versionCode: number;
  signedWith: SigningKey;
  channel: Channel;
  notes: string;
}

export async function uploadVersion(n: NewVersion): Promise<AppVersion> {
  await wait(420);
  const d = read();
  const app = d.apps.find((a) => a.id === n.appId);
  if (!app) throw new Error("App not found.");
  const highest = Math.max(0, ...app.versions.map((v) => v.versionCode));
  if (n.versionCode <= highest) throw new VersionCodeError(n.versionCode, highest);

  const v: AppVersion = {
    id: `v${Date.now().toString(36)}`,
    versionName: n.versionName.trim(),
    versionCode: n.versionCode,
    signedWith: n.signedWith,
    sizeBytes: 4_000_000 + Math.floor(Math.random() * 12_000_000),
    sha256: Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(""),
    uploadedAt: today(),
    channel: n.channel,
    rolloutPercent: 0,
    published: false,
    notes: n.notes.trim(),
  };
  app.versions.push(v);
  write(d);
  return v;
}

export async function publish(versionId: string, published: boolean): Promise<void> {
  await wait();
  const d = read();
  for (const a of d.apps) {
    const v = a.versions.find((x) => x.id === versionId);
    if (v) { v.published = published; if (published && v.rolloutPercent === 0) v.rolloutPercent = 10; write(d); return; }
  }
  throw new Error("Version not found.");
}

export async function setRollout(versionId: string, percent: number): Promise<void> {
  await wait(200);
  if (percent < 0 || percent > 100) throw new RolloutError();
  const d = read();
  for (const a of d.apps) {
    const v = a.versions.find((x) => x.id === versionId);
    if (v) { v.rolloutPercent = percent; write(d); return; }
  }
  throw new Error("Version not found.");
}

export async function setChannel(versionId: string, channel: Channel): Promise<void> {
  await wait(200);
  const d = read();
  for (const a of d.apps) {
    const v = a.versions.find((x) => x.id === versionId);
    if (v) { v.channel = channel; write(d); return; }
  }
  throw new Error("Version not found.");
}

/** Toggles used by the simulator to show what each precondition protects. */
export async function setDeviceFlag(
  deviceId: string, flag: "deviceOwner" | "batteryUnrestricted", value: boolean,
): Promise<void> {
  await wait(160);
  const d = read();
  const dev = d.devices.find((x) => x.id === deviceId);
  if (!dev) throw new Error("Device not found.");
  dev[flag] = value;
  write(d);
}

export async function setDeviceChannel(deviceId: string, channel: Channel): Promise<void> {
  await wait(160);
  const d = read();
  const dev = d.devices.find((x) => x.id === deviceId);
  if (!dev) throw new Error("Device not found.");
  dev.channel = channel;
  write(d);
}

/** Runs the check-in for one device and applies the result, as the phone would. */
export async function runCheckIn(deviceId: string): Promise<Decision[]> {
  await wait(520);
  const d = read();
  const dev = d.devices.find((x) => x.id === deviceId);
  if (!dev) throw new Error("Device not found.");
  const decisions = checkIn(dev, d.apps);
  for (const dec of decisions) {
    if (dec.outcome === "installed" && dec.target) {
      dev.installed[dec.app.packageName] = dec.target.versionCode;
      dev.installedWith = dec.target.signedWith;
    }
  }
  if (dev.batteryUnrestricted) dev.lastCheckIn = today();
  write(d);
  return decisions;
}

export interface Impact {
  version: AppVersion;
  app: ManagedApp;
  outcomes: Record<Outcome, number>;
  wouldInstall: number;
  wouldFail: number;
}

/**
 * What would happen if this version went to the whole fleet right now.
 *
 * The check-in evaluates rollout before signature, which is right for the phone:
 * a device outside the slice is never offered the build, so the signature
 * question never arises for it. But that means a signing problem only shows up
 * once the rollout is already turned up, with families broken. This runs the
 * same check with the rollout forced to 100, so the problem is visible before
 * publishing instead of after.
 */
export async function impactOf(versionId: string): Promise<Impact | null> {
  await wait(260);
  const d = read();
  for (const app of d.apps) {
    const v = app.versions.find((x) => x.id === versionId);
    if (!v) continue;
    const asIfLive: ManagedApp = {
      ...app,
      versions: [{ ...v, published: true, rolloutPercent: 100 }],
    };
    const outcomes: Record<Outcome, number> = {
      installed: 0, up_to_date: 0, not_in_rollout: 0, no_device_owner: 0,
      signature_mismatch: 0, downgrade_blocked: 0, not_published: 0, battery_restricted: 0,
    };
    for (const dev of d.devices) {
      // every device is asked on the version's own channel, not its own
      const probe: Device = { ...dev, channel: v.channel };
      outcomes[checkIn(probe, [asIfLive])[0].outcome] += 1;
    }
    const wouldInstall = outcomes.installed;
    const wouldFail = outcomes.signature_mismatch + outcomes.no_device_owner
      + outcomes.battery_restricted + outcomes.downgrade_blocked;
    return { version: v, app, outcomes, wouldInstall, wouldFail };
  }
  return null;
}

export interface FleetSummary {
  devices: number;
  checkedInToday: number;
  withoutDeviceOwner: number;
  asleep: number;
  onDebugBuilds: number;
  outcomes: Record<Outcome, number>;
  perApp: { app: ManagedApp; latest: AppVersion | null; onLatest: number; total: number }[];
}

export async function getSummary(): Promise<FleetSummary> {
  await wait();
  const d = read();
  const t = today();
  const perApp = d.apps.map((app) => {
    const latest = latestFor(app, "stable");
    const onLatest = latest
      ? d.devices.filter((dev) => dev.installed[app.packageName] === latest.versionCode).length : 0;
    return { app, latest, onLatest, total: d.devices.length };
  });
  return {
    devices: d.devices.length,
    checkedInToday: d.devices.filter((x) => x.lastCheckIn === t).length,
    withoutDeviceOwner: d.devices.filter((x) => !x.deviceOwner).length,
    asleep: d.devices.filter((x) => !x.batteryUnrestricted).length,
    onDebugBuilds: d.devices.filter((x) => x.installedWith === "debug").length,
    outcomes: simulateFleet(d.devices, d.apps),
    perApp,
  };
}

export async function reset(): Promise<void> {
  await wait();
  try { localStorage.removeItem(K); } catch { /* ignore */ }
  read();
}
