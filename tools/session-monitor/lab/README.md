# Lab experiments: measuring the five-session limit

The session monitor relies on how Qlik Sense counts sessions, and Qlik's own documentation doesn't
match what Sense does. These scripts measure that behaviour on a test site, so it can be checked again
on each new Sense release. They're for the people who maintain the monitor, not for running it.

What they found on Qlik Sense May 2026 (2026-11-14):

| Experiment                       | Question                                             | Result on May 2026                                                                                      |
| -------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `window.mjs`                     | How long until a user at the limit gets a slot back? | **360 ± 2 s** after the oldest record. Ending or signing out the session first makes no difference.     |
| `across-proxies.mjs`             | Is the limit per user across virtual proxies?        | **Yes.** 4 + 1 sessions on two virtual proxies fill it; the sixth is refused on both.                   |
| `existing-session.mjs`           | Is a session that's already in ever refused?         | **No.** It is let in, and its record is renewed, even when that makes six.                              |
| `lease.mjs`                      | Does working in an open app renew the record?        | **Only once its six minutes have run out.** The first action after that renews it.                      |
| `sign-in.mjs` + `watch-user.mjs` | The same, with a person clicking in a browser        | **Same result.** Opening a second app doesn't renew early, and an idle session lets its record run out. |
| `watch.mjs`                      | What happens to records over time?                   | An **hourly sweep** removes every licence record at once, live sessions' too.                           |

If a new release gives different numbers, update the monitor's `limit` settings, and its help text and
README, to match.

## Safety

- **Test site only.** The experiments open many sessions and fill users' slots. Don't run them against
  production.
- **Test users only.** Every experiment refuses any user id that doesn't match `testUsers.pattern` in
  the configuration. The test users need a licence (professional or analyzer). Note that they keep it,
  so they use up licences.
- **Read-only towards the site's setup.** The experiments change nothing in the QMC. They open and
  end sessions for test users, request proxy tickets for them, and read the APIs.
- **Certificates** are read where they are and never printed. Session ids are printed shortened,
  because a full one works as a session cookie.

## What the test site needs

- **A virtual proxy with header authentication** (for example prefix `demo`, header `X-Demo-User`,
  user directory `CORP`). The experiments use it to open sessions without a browser sign-in.
- **A virtual proxy with ticket authentication** (for example prefix `ticket`). It's used for a second
  way in, and to sign a person in as a test user.
- **A few test users** in that user directory (for example `sessiontest1` to `sessiontest6`). A license
  rule must give them professional or analyzer access, and a security rule must let them open two apps.
- **The site's client certificates,** exported from the QMC as for the monitor itself.
- **Google Chrome** on the computer running the experiments (`lease`, `existing-session` and
  `sign-in` use it). **Node.js 24.**
- Optional: **read access to Sense's log folder** (a read-only share works). With `licenceLog` set, the
  watchers also print the test user's lines from the licence trace log, so you can see `UsageGranted`,
  `UsageDenied` and `Update` (renewal) as Sense records them.

## Setup

```bash
cd tools/session-monitor
npm ci                                       # the experiments use the monitor's dependencies
cp lab/lab.config.example.yaml lab/lab.config.yaml   # then fill it in (ignored by git)
```

## Running the experiments

Run them from `tools/session-monitor`. Use a different test user for each run, or wait seven minutes
between runs with the same user, so its slots have run out. Running `watch.mjs` in a second terminal
alongside shows what happens site-wide.

| Command                                                                          | Takes                            |
| -------------------------------------------------------------------------------- | -------------------------------- |
| `node lab/watch.mjs [minutes]`                                                   | as long as you like (default 60) |
| `node lab/window.mjs sessiontest1 [wait\|delete\|signout]`                       | about 7 minutes                  |
| `node lab/across-proxies.mjs sessiontest2`                                       | under a minute                   |
| `node lab/existing-session.mjs sessiontest3`                                     | about 8 minutes                  |
| `node lab/lease.mjs sessiontest4 [minutes]`                                      | 9 minutes (default)              |
| `node lab/watch-user.mjs sessiontest5`, then `node lab/sign-in.mjs sessiontest5` | as long as the person tests      |

**The person-in-a-browser experiment.** Start `watch-user.mjs` for a test user, then run `sign-in.mjs`
for the same user. It opens a private Chrome window, signed in with a one-minute ticket. The person then
follows a timeline, and the watcher shows each renewal:

| Time       | What the person does                     | Expected on May 2026                                             |
| ---------- | ---------------------------------------- | ---------------------------------------------------------------- |
| 0:00       | Open the first app                       | A new record                                                     |
| 0:00–8:00  | Click every 20–30 s (selections, sheets) | No change until about 6:00, then one renewal at the next click   |
| ~8:30      | Open the second app and click in it      | No change: a second app doesn't renew early                      |
| 9:30–17:00 | Leave the window alone                   | No change: the record runs out about 6 minutes after its renewal |
| ~17:00     | One click                                | A renewal                                                        |

## How the experiments read Sense

- **Proxy sessions:** `GET /qps/{prefix}/user/{directory}/{id}` on every virtual proxy (port 4243).
- **Licence records:** `GET /qrs/license/professionalaccessusage/full` and `analyzeraccessusage`
  (port 4242), joined to the user through their access type. A record's `latestActivity` is what the
  limit counts.
- **A session's id** comes from its session cookie, whose value is `{GUID}:{session id}` on May 2026.
- **`lease.mjs`** sends selections over the app's own engine WebSocket in headless Chrome. Those are the
  same requests the UI sends when someone clicks.
