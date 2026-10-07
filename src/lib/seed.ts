/**
 * Sample catalogue and fleet. Fictional families on real Samsung model names,
 * sized like a beta: a handful of phones, a handful of apps.
 *
 * One clock: everything is relative to today.
 */
import { day, today, type AppVersion, type Device, type ManagedApp } from "./types";

function rng(n: number) {
  let a = (n * 0x9e3779b1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Data {
  apps: ManagedApp[];
  devices: Device[];
}

const hex = (r: () => number, n = 64) =>
  Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("");

export function generate(): Data {
  const r = rng(23);
  const t = today();

  const mk = (
    i: number, name: string, code: number, key: AppVersion["signedWith"],
    channel: AppVersion["channel"], rollout: number, published: boolean, days: number, size: number, notes: string,
  ): AppVersion => ({
    id: `v${i}`,
    versionName: name,
    versionCode: code,
    signedWith: key,
    sizeBytes: size,
    sha256: hex(r),
    uploadedAt: day(t, -days),
    channel,
    rolloutPercent: rollout,
    published,
    notes,
  });

  const apps: ManagedApp[] = [
    {
      id: "a1",
      packageName: "com.safephone.launcher",
      label: "Launcher",
      origin: "own",
      versions: [
        mk(1, "1.4.0", 140, "debug", "stable", 100, true, 48, 14_200_000, "The build the beta families are running."),
        mk(2, "1.5.0", 150, "debug", "stable", 100, true, 21, 14_800_000, "Shortcut grid, bug fixes."),
        mk(3, "1.6.0", 160, "release", "beta", 25, true, 3, 15_100_000, "First signed release build. Not on stable yet."),
      ],
    },
    {
      id: "a2",
      packageName: "com.safephone.guard",
      label: "Guard service",
      origin: "own",
      versions: [
        mk(4, "0.9.2", 92, "debug", "stable", 100, true, 40, 6_400_000, "Current stable."),
        mk(5, "0.9.3", 93, "debug", "stable", 50, true, 6, 6_500_000, "Half the fleet, watching for crashes."),
        mk(6, "0.9.4", 94, "debug", "beta", 0, false, 1, 6_600_000, "Uploaded, not published yet."),
      ],
    },
    {
      id: "a3",
      packageName: "com.safephone.store",
      label: "Private store client",
      origin: "own",
      versions: [
        mk(7, "0.3.0", 30, "debug", "stable", 100, true, 30, 3_900_000, "The store app updating itself is its own problem."),
        mk(8, "0.4.0", 40, "debug", "stable", 100, true, 9, 4_050_000, "Check-in backoff and retry."),
      ],
    },
    {
      id: "a4",
      packageName: "com.safephone.contacts",
      label: "Contacts",
      origin: "own",
      versions: [
        mk(9, "2.1.0", 210, "debug", "stable", 100, true, 60, 8_100_000, "Stable for a while."),
      ],
    },
  ];

  const FAMILIES = [
    ["Ferrer", "SM-A155F", 14], ["Oliveira", "SM-A146P", 14], ["Navarro", "SM-A057G", 13],
    ["Blasco", "SM-A155F", 14], ["Roca", "SM-A346B", 14], ["Guzmán", "SM-A057G", 13],
    ["Esteve", "SM-A155F", 15], ["Prat", "SM-A146P", 14], ["Casals", "SM-A346B", 14],
    ["Mir", "SM-A155F", 14], ["Vidal", "SM-A057G", 13], ["Soler", "SM-A155F", 15],
  ] as const;

  const devices: Device[] = FAMILIES.map(([family, model, android], i) => {
    // The beta fleet is on debug builds; that is the whole problem of phase one.
    const installedWith = "debug" as const;
    // Three phones were set up without the provisioning flow and have no device owner.
    const deviceOwner = ![2, 7, 10].includes(i);
    // Two phones have the store app asleep, which is the Samsung battery trap.
    const batteryUnrestricted = ![4, 9].includes(i);

    const installed: Record<string, number> = {
      "com.safephone.launcher": r() < 0.4 ? 140 : 150,
      "com.safephone.guard": r() < 0.5 ? 92 : 93,
      "com.safephone.store": r() < 0.3 ? 30 : 40,
      "com.safephone.contacts": 210,
    };
    // One phone is ahead of the catalogue because someone sideloaded by cable.
    if (i === 5) installed["com.safephone.guard"] = 95;

    return {
      id: `d${i + 1}`,
      serial: `R58${Math.floor(r() * 9e5 + 1e5)}X`,
      family,
      model,
      androidVersion: android,
      deviceOwner,
      batteryUnrestricted,
      installedWith,
      installed,
      lastCheckIn: batteryUnrestricted ? day(t, -Math.floor(r() * 2)) : day(t, -(9 + Math.floor(r() * 20))),
      channel: i < 3 ? "beta" : "stable",
    };
  });

  return { apps, devices };
}
