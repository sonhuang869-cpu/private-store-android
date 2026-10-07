import { BookOpen } from "lucide-react";
import { Callout } from "@/components/Bits";

const SECTIONS = [
  {
    id: "device-owner",
    title: "Silent install needs device owner",
    body: [
      "On stock Android there are only three ways to install an APK without a user tapping a confirmation: be the device owner, be signed with the platform key, or be rooted. For a product shipped on retail Samsung handsets, device owner is the only one of the three that is practical.",
      "Device owner is granted during provisioning, and provisioning only works on a device with no accounts configured. In practice that means a factory reset followed by the QR or NFC enrolment flow, or zero-touch enrolment if the handsets are bought through a reseller that supports it.",
      "This is the question that decides the shape of phase one. If the beta phones were already enrolled as device owner, the work is a client and a server. If they were not, the families' phones have to be reset and set up again, and that is a logistics problem before it is an engineering one.",
      "Worth knowing: from Android 12 an installer can update apps it installed itself without a prompt, using setRequireUserAction with USER_ACTION_NOT_REQUIRED. That covers updates but not the first install, and only for apps where the store is the installer of record. It is a useful fallback, not a replacement for device owner.",
    ],
  },
  {
    id: "signing",
    title: "Debug to release is a migration, not a build change",
    body: [
      "Android identifies an app by its package name and its signing certificate together. An update signed with a different key is not an update; the system treats it as a different app and refuses to install over the existing one.",
      "That means every phone currently running a debug-signed build cannot be moved to the release-signed build by the store. Each one needs the old app uninstalled and the new one installed, and uninstalling takes the app data with it.",
      "So the question is what data those apps hold, and what has to survive. If the launcher keeps per-child configuration locally, that configuration has to be backed up to the server before the migration and restored afterwards, or re-entered by hand with each family.",
      "Key rotation under APK Signature Scheme v3 exists, but it only helps if the original build was signed with rotation in mind. A debug key cannot be rotated into a release key after the fact.",
      "The practical order: ship the backup-and-restore first, on debug builds, through the existing cable process. Then do the key change once, with the data already safe.",
    ],
  },
  {
    id: "samsung",
    title: "Samsung puts unused apps to sleep",
    body: [
      "On Samsung's One UI, Device Care moves apps it considers unused into Sleeping or Deep sleeping. A sleeping app does not run background work, which means the store client never checks in and the phone silently stops receiving updates.",
      "It does not produce an error anywhere. The fleet simply develops a tail of phones that are weeks behind, and the only symptom is a last-check-in date that stops moving. Two phones in this demo are in exactly that state.",
      "As device owner, the store app can add itself to the battery optimisation exemption list, which is the correct fix and one more reason device owner matters. Without it, somebody has to walk each family through a settings screen.",
      "The check-in itself should be WorkManager with a network constraint and exponential backoff, not an alarm. And the server should treat a phone that has not checked in for a few days as an alert, not as a number in a table.",
    ],
  },
  {
    id: "rollout",
    title: "A bad update reaches every child at once",
    body: [
      "The difference between a private store and a cable is that the store can break the whole fleet in one go. Three things keep that from happening.",
      "Staged rollout: a version is offered to a stable slice of the fleet, by hashing the device id against the version id. Stable matters — a device that was offered a build must not be told later that it is not entitled to it.",
      "A dry run before turning the rollout up. Asking every phone what it would do at 100% is the only way to see a signing or provisioning problem before families hit it. At 25% most phones answer that they are not in the slice, and the real problem stays hidden behind that.",
      "And a way back. Since versionCode must increase, a rollback is not a downgrade: it is publishing the previous build again with a higher code. That has to be prepared in advance, because doing it under pressure is how the wrong APK goes out.",
    ],
  },
  {
    id: "trust",
    title: "The phone does not trust the server",
    body: [
      "Every refusal in the check-in trace happens on the device. The server proposes; the client decides.",
      "The client verifies the SHA-256 of what it downloaded against the catalogue entry, and checks the APK's signing certificate against the one already installed, before it opens a PackageInstaller session. A server that has been tampered with cannot talk a phone into installing something it should refuse.",
      "The download itself should be over HTTPS with certificate pinning, and the catalogue response signed, so that a compromised CDN cannot substitute a build.",
      "This costs very little to do at the start and is close to impossible to retrofit, because by then the fleet is already trusting whatever the server says.",
    ],
  },
  {
    id: "third-party",
    title: "What changes when third-party apps are added",
    body: [
      "Phase one ships our own apps, but the shape has to allow others later. Three things change and they are worth designing for now.",
      "Ownership of the signing key. Our apps are signed by us; a third-party APK is signed by its author, and the store cannot re-sign it without breaking its identity. The catalogue has to record the expected certificate per app rather than assume one key.",
      "Approval. Right now publishing is a switch. With third-party apps there is a review step, and somebody has to be accountable for what lands on a child's phone.",
      "Per-device entitlement. Our apps go to every managed phone. A third-party app goes to the phones whose parents allowed it, which means a policy layer between the catalogue and the fleet, and that is where this touches job 2.",
    ],
  },
];

export default function Notes() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BookOpen className="size-6 shrink-0 text-primary" aria-hidden /> Constraints
        </h1>
        <p className="mt-2 text-muted-foreground">
          What decides the shape of phase one, and what I would want answered before writing the
          first line of Kotlin.
        </p>
        <div className="mt-4">
          <Callout>
            None of these are opinions about how to build it. They are properties of Android and of
            Samsung's shell, and each one either costs nothing at the start or a great deal later.
          </Callout>
        </div>
      </div>

      {SECTIONS.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-24" data-testid={`note-${s.id}`}>
          <h2 className="text-xl font-semibold">{s.title}</h2>
          <div className="mt-2 space-y-3">
            {s.body.map((p, i) => (
              <p key={i} className="leading-relaxed text-muted-foreground">{p}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
