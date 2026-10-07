/**
 * The check-in. This is the whole protocol, as a pure function: a device plus
 * the catalogue go in, a decision and a trace come out.
 *
 * Every refusal below happens on the phone, not on the server. That matters:
 * a compromised or misconfigured server must not be able to talk a phone into
 * installing something it should refuse.
 */
import {
  inRollout, latestFor,
  type AppVersion, type Device, type ManagedApp, type Outcome,
} from "./types";

export interface Step {
  label: string;
  detail: string;
  tone: "ok" | "idle" | "blocked";
}

export interface Decision {
  app: ManagedApp;
  target: AppVersion | null;
  outcome: Outcome;
  steps: Step[];
}

export function checkIn(device: Device, apps: ManagedApp[]): Decision[] {
  return apps.map((app) => {
    const steps: Step[] = [];
    const push = (label: string, detail: string, tone: Step["tone"] = "ok") =>
      steps.push({ label, detail, tone });

    const installed = device.installed[app.packageName];
    const target = latestFor(app, device.channel);

    // 0. A phone whose store app is asleep never reaches the server at all.
    if (!device.batteryUnrestricted) {
      push("Check-in", "The phone never called. Samsung put the store app to sleep, so the background job never ran.", "blocked");
      return { app, target, outcome: "battery_restricted", steps };
    }
    push("Check-in", `Phone reports ${app.packageName} at versionCode ${installed ?? "none"}.`);

    if (!target) {
      push("Catalogue", `No published version on the ${device.channel} channel.`, "idle");
      return { app, target, outcome: "not_published", steps };
    }
    push("Catalogue", `Latest published on ${device.channel}: ${target.versionName} (code ${target.versionCode}).`);

    if (installed !== undefined && target.versionCode === installed) {
      push("Compare", "Same versionCode. Nothing to do.", "idle");
      return { app, target, outcome: "up_to_date", steps };
    }

    if (installed !== undefined && target.versionCode < installed) {
      push("Compare", `Server offers ${target.versionCode}, phone already has ${installed}. Android refuses to go backwards, and so do we.`, "blocked");
      return { app, target, outcome: "downgrade_blocked", steps };
    }

    if (!inRollout(device.id, target.id, target.rolloutPercent)) {
      push("Rollout", `Version is at ${target.rolloutPercent}% and this device is not in that slice. It will be offered later.`, "idle");
      return { app, target, outcome: "not_in_rollout", steps };
    }
    push("Rollout", `Version is at ${target.rolloutPercent}% and this device is in the slice.`);

    // The signature check. This is the one that bites on the debug to release move.
    if (installed !== undefined && target.signedWith !== device.installedWith) {
      push(
        "Signature",
        `Installed build is signed with the ${device.installedWith} key, the new APK with the ${target.signedWith} key. Android will not update across a key change. It needs an uninstall and a fresh install, and app data is lost.`,
        "blocked",
      );
      return { app, target, outcome: "signature_mismatch", steps };
    }
    push("Signature", installed === undefined
      ? `First install, signed with the ${target.signedWith} key.`
      : `Same signing key as the installed build.`);

    push("Integrity", `SHA-256 of the downloaded APK matches the catalogue: ${target.sha256.slice(0, 16)}…`);

    // Silent install needs device owner. Without it the user sees a prompt.
    if (!device.deviceOwner) {
      push(
        "Install",
        "The store app does not hold device owner, so PackageInstaller shows a confirmation dialog. On a child's phone there is nobody to tap it.",
        "blocked",
      );
      return { app, target, outcome: "no_device_owner", steps };
    }

    push("Install", `Device owner present. PackageInstaller session committed without any prompt. Now on ${target.versionName}.`);
    return { app, target, outcome: "installed", steps };
  });
}

/** What the fleet would do if everyone checked in right now. */
export function simulateFleet(devices: Device[], apps: ManagedApp[]) {
  const counts: Record<Outcome, number> = {
    installed: 0, up_to_date: 0, not_in_rollout: 0, no_device_owner: 0,
    signature_mismatch: 0, downgrade_blocked: 0, not_published: 0, battery_restricted: 0,
  };
  for (const d of devices) for (const dec of checkIn(d, apps)) counts[dec.outcome] += 1;
  return counts;
}
