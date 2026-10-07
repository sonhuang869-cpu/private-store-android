# Private app store — operator console

A demo built for a Workana posting: a Barcelona startup running a safe-phone
product for children on Samsung handsets, where app updates are currently
installed by cable. Phase one of their job 1 is a private app store — a server
that hosts approved apps, and phones that check in and install silently.

An APK cannot be shipped as a demo link, so this is the other half of phase one:
the server side, plus a simulator for the phone, so the rules can be read and
argued with before any Kotlin is written.

Everything in it is invented — families, Samsung model names, package names,
SHA-256 values. No APK is uploaded, downloaded or installed anywhere. What is
real is the decision logic.

## The three things it exists to show

**Silent install needs device owner.** There are three ways to install an APK
without a user tapping a confirmation: be the device owner, be signed with the
platform key, or be rooted. On retail Samsung handsets only the first is
practical, and it is granted at provisioning on a device with no accounts
configured — in practice, a factory reset. Open a phone without it and the
check-in trace stops at `PackageInstaller`, in front of a dialog that nobody on
a child's phone is going to tap.

**Debug to release is a migration, not a build change.** Android identifies an
app by package name *and* signing certificate together. A build signed with a
different key is not an update; the system treats it as a different app and
refuses to install over the existing one. Every phone needs an uninstall and a
fresh install, and the uninstall takes the app data with it.

**Samsung puts unused apps to sleep.** One UI's Device Care moves apps it
considers unused into Sleeping, then Deep sleeping. A sleeping app runs no
background work, so the store client never checks in. It raises no error
anywhere — the only symptom is a last-check-in date that stops moving.

## The dry run

The feature the demo is built around. A version at 25% rollout looks healthy,
because at 25% most phones simply answer that they are not in the slice — and a
signing or provisioning problem hides behind that answer.

`impactOf()` runs the same check-in against the whole fleet with the rollout
forced to 100, before anything is turned up. On the seeded data, the
release-signed build of the launcher reports **0 would install, 12 would not**,
ten of them on signature mismatch.

## Decision order

`src/lib/checkin.ts` is a pure function, `checkIn(device, apps) -> Decision[]`,
one decision per app with the steps that produced it:

    battery -> catalogue -> up to date -> downgrade -> rollout
            -> signature -> integrity -> device owner -> install

Rollout is evaluated before signature, which is correct for the phone and is
exactly why the dry run exists.

Two rules that are easy to get wrong and are asserted in the tests:

- **The rollout slice must be stable.** It hashes device id against version id,
  so a phone offered a build is never later told it is not entitled to it.
  Chosen randomly per check-in, a staged rollout is a lottery.
- **Beta includes stable, not the other way round.** Treating beta as a separate
  track means that the moment a version is promoted from beta to stable, the
  beta phones have nothing to install — which is backwards.

## Stack

Vite, React 19, TypeScript, Tailwind v4, React Router v6, shadcn/ui, Lucide,
Sonner. State lives in `localStorage` behind an async API in `src/lib/api.ts`
with a 200–600 ms delay, so the UI handles latency the way it would against a
real server. Reset in the header restores the seed.

    npm install
    npm run dev

## Verification

96 assertions against the data layer, run under Node against `src/lib/*`, and a
35-assertion Playwright sweep against the built app at 1320px and 390px — the
dry run exposing the signature problem the 25% rollout hides, device owner
flipping the outcome, a sleeping phone producing no check-in at all, versionCode
monotonicity, and the responsive layouts. No console errors.

Justin Gnoh · October 2026
