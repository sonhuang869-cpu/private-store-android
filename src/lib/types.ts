/**
 * Domain for the private app store.
 *
 * The rule that decides everything else: a silent install is only possible when
 * the store app is device owner, and an update is only possible when the new
 * APK is signed with the same key as the one already on the phone.
 *
 * Both of those are checked on the device, not on the server, so the server
 * cannot talk a phone into installing something it should refuse.
 */

export type Channel = "beta" | "stable";

export type SigningKey = "debug" | "release";

export const KEY_LABEL: Record<SigningKey, string> = {
  debug: "Debug key (androiddebugkey)",
  release: "Release key (upload keystore)",
};

export interface AppVersion {
  id: string;
  versionName: string;
  /** Monotonic. Android refuses to install a lower one over a higher one. */
  versionCode: number;
  signedWith: SigningKey;
  sizeBytes: number;
  sha256: string;
  uploadedAt: string;
  channel: Channel;
  /** Percentage of the fleet allowed to pick it up. */
  rolloutPercent: number;
  published: boolean;
  notes: string;
}

export interface ManagedApp {
  id: string;
  packageName: string;
  label: string;
  /** Ours, or third party added later. Phase one only ships ours. */
  origin: "own" | "third_party";
  versions: AppVersion[];
}

export type DeviceState = "ok" | "stale" | "offline" | "blocked";

export interface Device {
  id: string;
  serial: string;
  family: string;
  model: string;
  androidVersion: number;
  /** Whether the store app holds device owner. Without it there is no silent install. */
  deviceOwner: boolean;
  /** Samsung puts unused apps to sleep; a sleeping store never checks in. */
  batteryUnrestricted: boolean;
  /** Which key signed the build currently installed on this phone. */
  installedWith: SigningKey;
  installed: Record<string, number>;
  lastCheckIn: string;
  channel: Channel;
}

export type Outcome =
  | "installed"
  | "up_to_date"
  | "not_in_rollout"
  | "no_device_owner"
  | "signature_mismatch"
  | "downgrade_blocked"
  | "not_published"
  | "battery_restricted";

export const OUTCOME_LABEL: Record<Outcome, string> = {
  installed: "Installed",
  up_to_date: "Already up to date",
  not_in_rollout: "Outside the rollout slice",
  no_device_owner: "No device owner",
  signature_mismatch: "Signature mismatch",
  downgrade_blocked: "Downgrade blocked",
  not_published: "Version not published",
  battery_restricted: "Never checked in",
};

export const OUTCOME_TONE: Record<Outcome, "ok" | "idle" | "blocked"> = {
  installed: "ok",
  up_to_date: "idle",
  not_in_rollout: "idle",
  no_device_owner: "blocked",
  signature_mismatch: "blocked",
  downgrade_blocked: "blocked",
  not_published: "idle",
  battery_restricted: "blocked",
};

export const today = (): string => new Date().toISOString().slice(0, 10);

export const day = (base: string, add: number): string => {
  const [y, m, d] = base.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + add * 86400000).toISOString().slice(0, 10);
};

export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);

export const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export const shortDate = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Stable slice membership. A device is either in the rollout or it is not, and
 * it does not flip between check-ins — otherwise a phone could be given an
 * update and then told it is not entitled to it.
 */
export function inRollout(deviceId: string, versionId: string, percent: number): boolean {
  if (percent >= 100) return true;
  if (percent <= 0) return false;
  let h = 2166136261;
  for (const c of deviceId + ":" + versionId) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100 < percent;
}

/**
 * Beta includes stable, not the other way round.
 *
 * A beta device is a device that gets things earlier, not a device on a separate
 * track. Treating beta as a track of its own means that the moment a version is
 * promoted from beta to stable, the beta phones are left with nothing to
 * install — which is exactly backwards.
 */
export const latestFor = (app: ManagedApp, channel: Channel): AppVersion | null =>
  app.versions
    .filter((v) => v.published && (channel === "beta" || v.channel === "stable"))
    .sort((a, b) => b.versionCode - a.versionCode)[0] ?? null;
