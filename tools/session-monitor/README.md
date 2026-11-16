<p align="center">
  <a href="https://ptarmiganlabs.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/brand/ptarmigan-labs-wordmark-on-dark.svg">
      <img src="docs/brand/ptarmigan-labs-wordmark-on-light.svg" alt="Ptarmigan Labs" width="280">
    </picture>
  </a>
</p>

# Qlik Sense session monitor

A live web page for Qlik Sense Enterprise on Windows (client-managed). It shows who is connected right now, how close each user is to Qlik Sense's limit of **five sessions**, and who is being turned away with _"You cannot access Qlik Sense because you have too many sessions active in parallel."_

![The desk layout: overview, users by slots in use, and one user's session timeline](docs/desk.jpg)

▶ **[Watch the 4-minute video](https://youtu.be/kRUpunrj56M)** for a guided tour of the page.

- **One page, updated every 15 seconds.** Countdowns and rings move every second in between.
- **Nothing to install on the Sense server.** It only reads Sense's own APIs, and changes nothing,
  unless you start it with [`--allow-session-delete`](#ending-sessions-from-the-page-testing-only).
- **Help is built in.** Every **?** on the page explains the part next to it, with a diagram.

> **This is a live view, not a monitoring system.** It shows how things stand now and keeps no
> history. For real monitoring of Qlik Sense, with history over days, months and years, dashboards
> and alerting, use [Butler SOS](https://butler-sos.ptarmiganlabs.com). This live view is planned to
> become part of Butler SOS.

## Quickest start: download one program

The monitor comes as a single program for Windows, macOS (Apple silicon) and Linux, with nothing
else to install. Download the zip for your computer from the current release,
**[session monitor 0.2.0](https://github.com/ptarmiganlabs/butler-sos/releases/tag/session-monitor-v0.2.0)**
(all versions are [here](https://github.com/ptarmiganlabs/butler-sos/releases?q=session-monitor)),
and unzip it:

| Computer              | Download                                          | Size  | Signed                        |
| --------------------- | ------------------------------------------------- | ----- | ----------------------------- |
| Windows (x64)         | `qseow-session-monitor-<version>-win-x64.zip`     | 35 MB | by Ptarmigan Labs AB          |
| macOS (Apple silicon) | `qseow-session-monitor-<version>-macos-arm64.zip` | 40 MB | signed and notarised by Apple |
| Linux (x64)           | `qseow-session-monitor-<version>-linux-x64.zip`   | 44 MB | no                            |

The program unzips to about 120 MB, because it carries Node.js inside it. Windows may still show a
SmartScreen warning the first few times a new version is downloaded, even though it is signed; we
haven't tested this. Each release's notes include a VirusTotal scan of the zips, and
`gh attestation verify <program> --repo ptarmiganlabs/butler-sos`, run on the unzipped program
(not the zip), proves it came from the release workflow.

- **On the Sense server itself** (the central node), run `qseow-session-monitor.exe` as an
  administrator, for example by right-clicking it and choosing _Run as administrator_. It finds
  the server's name and Sense's own certificates by itself, and opens the page in the browser.
  That's all. (Checked on Qlik Sense Enterprise on Windows May 2026.)
- **On any other computer**, first export certificates from the QMC (step 2 below), then:

    ```bash
    qseow-session-monitor --host <central node> --certs <folder with the certificates>
    ```

- **No Sense server at hand?** Run it with no options and answer **Y** when it offers the demo,
  or start it with `--simulate 300`.

It runs until you press **Ctrl+C**. `qseow-session-monitor --help` lists every option. For the
settings beyond those, put a `config.yaml` next to the program (the zip includes
`config.example.yaml`).

> **macOS:** the first time the program connects to your Sense server, macOS asks whether it may
> find devices on your local network. Allow it, or the connection times out.

## Try it in two minutes, without a Sense server

This and the following sections run it from the source code instead, with Node.js.

You need [Node.js](https://nodejs.org) 24 or later. Check with `node --version`.

1. Get the code: download the Butler SOS repository from GitHub (_Code → Download ZIP_) and unzip
   it, or `git clone https://github.com/ptarmiganlabs/butler-sos.git`.
2. In a terminal (PowerShell on Windows), go to the `tools/session-monitor` folder inside it and
   start the demo:

    ```bash
    cd butler-sos/tools/session-monitor     # with the ZIP: butler-sos-master/tools/session-monitor
    npm ci
    npm run demo
    ```

3. Open **<http://127.0.0.1:3939/>** in your browser.

The demo makes up a site of 300 users. It follows the same rules as Qlik Sense: most users keep one session, some open several, a few hit the limit, and a couple of scripts keep starting new sessions. Stop it with **Ctrl+C**. For another size, use `node src/index.js --simulate 1000`.

## Connect it to your Qlik Sense site

This takes about ten minutes. You need to be a Sense administrator: the monitor uses the same certificates that Sense's own services use to talk to each other.

### 1. Pick a computer to run it on

Any Windows, macOS or Linux computer with Node.js 24 that can reach:

- the **central node** on port **4242** (the Repository), and
- **every proxy node** on port **4243** (the Proxy). On a single-server site that's the same server.

The central node itself works too, as long as Node.js is installed there.

### 2. Export certificates from the QMC

1. In the QMC, open **Certificates** and click **Export**.
2. **Machine name:** the name of the computer from step 1. Any name works; it only names the folder.
3. **Certificate password:** leave it **empty**.
4. **Include secret key:** tick it.
5. **Export file format for certificates:** choose **Platform independent PEM-format**.
6. Click **Export certificates**.

The files appear on the central node in
`C:\ProgramData\Qlik\Sense\Repository\Exported Certificates\<machine name>\`. Copy
`client.pem`, `client_key.pem` and `root.pem` to a folder on the computer from step 1, for example
`C:\sense-certs` or `/home/me/sense-certs`.

> **Treat these files like an administrator password.** Anyone who has them has full access to your
> Sense site through its APIs. Keep them in a folder only you can read, never email them, and never
> put them in a repository.

### 3. Create the configuration

In this folder, copy `config.example.yaml` to `config.yaml`:

```bash
cp config.example.yaml config.yaml          # macOS, Linux
Copy-Item config.example.yaml config.yaml   # Windows PowerShell
```

Open `config.yaml` and change the two lines marked **CHANGE THIS**:

```yaml
sense:
    host: sense.mycompany.com # your central node, by the name the QMC shows under Nodes
    certDir: 'C:\sense-certs' # the folder with the three .pem files
```

Use the server's name, not its IP address: the certificates are made for the name. On Windows,
keep the single quotes around the path.

### 4. Start it

```bash
npm ci       # only the first time
npm start
```

It prints `Open http://127.0.0.1:3939/ in your browser.` Do that. The first data arrives within a
few seconds. Stop it with **Ctrl+C**. It stops within a few seconds, at once with a second **Ctrl+C**.

`node src/index.js --once` reads Sense once, prints a table of users and exits. It's a quick way to check the configuration without the page.

## Using the page

- **Overview tiles:** users at the limit, users with one slot left, connected users, proxy sessions,
  refused sessions, and the site's licences (as the QMC's licence summary shows them).
- **Users by slots in use:** how many users hold 0, 1, 2 … 5 slots. Click a bar to list those users.
- **Users:** five rings per user, one per slot. A ring empties over six minutes. The countdown
  shows when the next slot is free again, or, at the limit, when a new session will be allowed.
    - **Filter** with _Needs attention_, _At the limit_, _One slot left_ or _Refused_, search by name,
      and sort.
    - **Click a user** to see their sessions on a timeline.
- **Entry points:** sessions, users and refusals per virtual proxy and per proxy server.
- **Live feed:** refusals and alerts as they happen. Tick _Sign-ins_ to see every new session too.
- **Desk or Wall** (top right): _Wall_ is for a second screen or a TV. It shows only users who need
  attention, in large tiles, and a calm "All users are within limits" when no one does.
- **Light or dark** (top right), or set both in the address: `http://127.0.0.1:3939/?mode=wall&theme=dark`.

![The wall layout: only users who need attention](docs/wall.jpg)

## The five-session limit in short

Qlik Sense lets each user be **active in at most five different sessions within any six minutes**.
The page calls each of those a **slot**.

- **A session takes a slot when it gets in:** its first page load in a new browser, an incognito
  window, or a script without a saved cookie.
- **A slot lasts six minutes, and is renewed while the session is in use.** If the session is still
  working in an app when the six minutes run out (selections, sheets, opening an app), its next
  action renews the slot. A session in use all day keeps its slot all day.
- **Otherwise the slot is free again after six minutes:** the session was closed, left idle, or only
  used in the hub. That holds even if the session is still open in a browser tab.
- **With all five slots taken, a new session is refused.** Sessions that are already in keep
  working.
- **Closing sessions doesn't help.** Signing out, closing the browser or ending sessions in the QMC
  frees no slot sooner. Only waiting does.
- **It counts across all virtual proxies** together, and very likely across all proxy servers too
  (not yet tested on a site with several proxy nodes).

The **?** next to _Users_ on the page explains this with a diagram. These figures were measured on Qlik Sense May 2026. Qlik's help says five minutes, but six (360–370 seconds) is what was measured, by Qlik Support as well.

The whole story is in the blog post [Five's company, six is a crowd: how Qlik Sense's session limit
really works](https://ptarmiganlabs.com/qlik-sense-session-monitor/): how the limit was measured, a
decade of conflicting answers about it, and a tour of this page.

## If something doesn't work

The monitor says what's wrong when it starts. The common cases:

| Message                                                   | What to do                                                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `No configuration file found`                             | Copy `config.example.yaml` to `config.yaml` (step 3).                                           |
| `Certificate files not found`                             | Point `certDir` at the folder holding `client.pem`, `client_key.pem` and `root.pem` (step 2).   |
| `… can't be resolved from this computer`                  | Use the server's full DNS name in `host`.                                                       |
| `Can't reach … on ports 4242 and 4243`                    | Open those ports in the firewall between this computer and the Sense server(s).                 |
| `… must be the name the Sense certificates were made for` | Use the central node's name as the QMC shows it under **Nodes**, not an IP address or an alias. |
| `Use root.pem from the same QMC certificate export`       | All three files must come from the same export of the same site.                                |
| `Sense refused the client certificate`                    | Export the certificates again from this site's QMC.                                             |
| `Port 3939 is already in use`                             | Another copy is running: stop it, or set `outputs.web.port` to another port.                    |
| The page says **No data**                                 | The monitor has stopped or can't read Sense: look at its window for errors.                     |

## Ending sessions from the page (testing only)

> [!WARNING]
> **This is for testing and debugging, on a test or lab site. Don't use it in production.** With
> `--allow-session-delete`, **anyone who can open the page can end any user's Sense session**. The
> page has **no login**, and this option does not add one.

Started with `--allow-session-delete`, the monitor shows **Session ending on** in red in the page's
header, and each user's open sessions get an **End** button below their timeline:

```bash
qseow-session-monitor --allow-session-delete
```

**What End does:** after you confirm, the monitor ends that **proxy session** in Sense, as the Proxy
API's `DELETE /qps/{virtual proxy}/session/{id}` does. The user's browser tab loses its Sense
session at once and has to be reloaded. Anything they hadn't saved in an app may be lost.

**What End does _not_ do: free a slot.** A slot is held for six minutes after the session's
last licence check, whether or not the session still exists ([details](#the-five-session-limit-in-short)).
A user who is refused for having five sessions is still refused right after you end one, until that
session's six minutes have run out. That's Sense's rule, measured on a real site; this tool can't
change it.

**The limits it keeps to:**

- **Only on this computer.** It refuses to start unless the page is bound to `127.0.0.1`, `::1` or
  `localhost` (the default). The page must be opened on the computer running the monitor; it also
  refuses requests that come through a reverse proxy, a different host name or another website.
- **Only sessions it can see.** End works on the sessions in the monitor's own list, on the proxy and
  virtual proxy where it found them. It can't be pointed at anything else.
- **Every End is logged** on the console: the time, the session id, the user, and the proxy and
  virtual proxy.
- **Nothing else changes.** No other write reaches Sense, and without the option there's no End
  button and no way to end a session from the page at all.

To end every session of one user on a virtual proxy at once, use the QMC or the Proxy API's
`DELETE /qps/{virtual proxy}/user/{directory}/{user id}`; this tool doesn't do that.

## Showing the page to others

By default only the computer running the monitor can open the page (`127.0.0.1`). The page has
**no login of its own**. To show it to others, put it behind a reverse proxy that asks for sign-in
(IIS, nginx, Traefik …):

- **Proxy on the same computer:** keep `127.0.0.1`, and point the proxy at `http://127.0.0.1:3939`.
- **Proxy on another computer:** set `outputs.web.host` to this computer's address, and let the
  firewall allow port 3939 **only from the proxy**. Otherwise anyone on the network could skip the
  proxy's sign-in and open the page directly.

## Configuration reference

Everything except `sense.host` and `sense.certDir` has a sensible default. See the comments in
[config.example.yaml](config.example.yaml).

| Setting                                 | Default                         |                                                                                                         |
| --------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `sense.host`                            | —                               | The central node. Proxy servers and virtual proxies are found from it.                                  |
| `sense.certDir`                         | —                               | Folder with `client.pem`, `client_key.pem`, `root.pem`. A relative path is relative to the config file. |
| `sense.virtualProxies`                  | all                             | Only watch these virtual proxy prefixes.                                                                |
| `outputs.web.host`, `outputs.web.port`  | `127.0.0.1`, `3939`             | Where the page listens.                                                                                 |
| `outputs.web.title`                     | server name                     | The name in the page header.                                                                            |
| `outputs.web.timelineMinutes`           | 30                              | How far back a user's timeline reaches.                                                                 |
| `outputs.console.table`                 | `false`                         | Also print a table of users at every update.                                                            |
| `poll.intervalSeconds`                  | 15                              | How often Sense is read.                                                                                |
| `limit.sessions`, `limit.windowSeconds` | 5, 360                          | The limit and its window.                                                                               |
| `limit.warnAt`, `limit.criticalAt`      | 4, 5                            | When a user shows as _one slot left_ and _at the limit_.                                                |
| `limit.excludeUsers`                    | Sense's internal `sa_` accounts | Users never shown, as `DIRECTORY\userid`.                                                               |

### Optional: pass alerts on to other systems

Neither is needed for the page.

- **Webhook** (`outputs.webhook`): each alert and refusal is POSTed as JSON. The bearer token comes from the environment variable named in `tokenEnv`. Example:

    ```json
    {
        "source": "qseow-session-monitor",
        "type": "alert",
        "at": "2026-11-14T14:23:36.720Z",
        "level": "critical",
        "change": "raised",
        "userDirectory": "CORP",
        "userId": "jane.doe",
        "slotsUsed": 5,
        "slotsLimit": 5,
        "proxySessions": 6,
        "nextSlotFreeAt": "2026-11-14T14:29:17.417Z"
    }
    ```

- **MQTT** (`outputs.mqtt`), for Node-RED, Home Assistant and the like. The user name and password come from the environment variables named in the configuration.

    | Topic below `topicRoot`     | Content                                     |
    | --------------------------- | ------------------------------------------- |
    | `alert`                     | Each alert (JSON).                          |
    | `refused`                   | Each refused session (JSON).                |
    | `summary`                   | Totals, every update (retained).            |
    | `user/<directory>/<userid>` | Each user's state, every update (retained). |

## How it works

[![How the session monitor works: it reads the Proxy (QPS) on every proxy node and the Repository (QRS) on the central node over HTTPS, joins sessions to licence usage records to count each user's slots, and pushes the result to a live web page over Server-Sent Events](src/web/how-it-works.svg)](src/web/how-it-works.svg)

The same picture is on the page, under the **?** next to its title. A PNG copy for slides and
posts is in [`docs/how-it-works.png`](docs/how-it-works.png).

Every 15 seconds the monitor reads Sense:

- **The open sessions** on every proxy server and virtual proxy (Proxy API, port 4243).
- **Sense's licence usage records** (Repository API, port 4242). Each record tells when a session last
  took a licence check. That is what the five-session limit counts: records younger than six minutes
  are the slots.
- **The licence allocations and totals,** about once a minute.

A **refused session** is a new session of a licensed user that never gets a licence record. Checked
against Sense's own licence log, every session found that way was a real refusal. It can miss a
refused session that is closed again within 15 seconds, which in practice means scripts. Accounts
without a licence (service accounts) are never counted as refused.

On a large site, only records from the last half hour are read, the page draws 50 users at a time,
and each user's timeline is only sent when it's opened. The page was checked with 1,000 simulated
users.

**Not covered yet:** sites with several proxy nodes are read, but this was tested on a single-node site.  
Analyzer capacity and token-based licences aren't read. Direct engine connections (port 4747) weren't checked.

## For developers

```bash
npm test                              # unit tests
node src/index.js --simulate 300      # the demo, with a config file of your own: add --config
npm run build:binary                  # the single program, for this computer, in dist/
```

The program is Node.js's own [single executable application](https://nodejs.org/api/single-executable-applications.html):
`scripts/build-binary.mjs` bundles the code with esbuild, adds the page's files as assets, and puts
both into a copy of Node.js. The release workflow, `.github/workflows/session-monitor-release.yaml`,
builds it on Windows, macOS and Linux, signs the Windows and macOS programs, and drafts a release
tagged `session-monitor-v<version>`.

The code: `src/collect.js` reads Sense, `src/model.js` turns readings into users, slots and events,
`src/simulate.js` is the demo site, `src/outputs/` holds the console, web page, webhook and MQTT
outputs, and `src/web/` is the page itself (plain HTML, CSS and JavaScript, no build step, nothing
loaded from the internet).

## About Ptarmigan Labs

The session monitor is made by [Ptarmigan Labs](https://ptarmiganlabs.com), the makers of
[Butler SOS](https://butler-sos.ptarmiganlabs.com). At [ptarmiganlabs.com](https://ptarmiganlabs.com) you'll find more free and open-source tools for Qlik Sense, blog posts about
running Qlik Sense, and professional services when you want help getting the most out of it.

## Credits

- **Finding every proxy server and virtual proxy from the Repository** follows Ctrl-Q's `session-get` command ([ptarmiganlabs/ctrl-q](https://github.com/ptarmiganlabs/ctrl-q), MIT).
- **Joining proxy sessions to licence usage records** is an idea from Christof Schwarz's sessionTerminator ([ChristofSchwarz/qs-OEM-tricks](https://github.com/ChristofSchwarz/qs-OEM-tricks)).

## Licence

MIT, same as Butler SOS.
