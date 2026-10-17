# One Line per Error in Docker Logs

When Butler SOS runs in Docker, error messages in the log are now **one line each**. They no
longer carry a stack trace — the block of `at ...` lines naming source files and line numbers
inside Butler SOS.

This is how the standalone Butler SOS executables (Windows, macOS, Linux) have always logged
errors. Docker now behaves the same way.

---

## What changed

A stack trace shows which code was running when an error happened. It is useful to someone
working on Butler SOS itself, and rarely to anyone running it. Until now, Butler SOS in Docker
added one to almost every error, because the Docker image runs Butler SOS from its source code,
and stack traces were tied to that.

During an outage — InfluxDB down, say, or a Qlik Sense server not answering — that made the
container log hard to read: each error took ten lines or more, and the messages that mattered
were spread thin.

**Before**, in a Docker log:

```text
error: HEALTH: Error when calling health check API for server 'sense1' (192.168.100.109:4747): timeout of 5000ms exceeded
error: Stack trace: AxiosError: timeout of 5000ms exceeded
    at createTimeoutError (file:///nodeapp/node_modules/axios/lib/adapters/http.js:597:16)
    at RedirectableRequest.handleTimeout (file:///nodeapp/node_modules/axios/lib/adapters/http.js:1320:17)
    at RedirectableRequest.emit (node:events:509:28)
    at Timeout._onTimeout (/nodeapp/node_modules/follow-redirects/index.js:233:12)
    at listOnTimeout (node:internal/timers:635:17)
    at process.processTimers (node:internal/timers:571:7)
    at Axios.request (file:///nodeapp/node_modules/axios/lib/core/Axios.js:46:41)
    at async getHealthStatsFromSense (file:///nodeapp/src/lib/healthmetrics.js:77:26)
```

**Now**:

```text
error: HEALTH: Error when calling health check API for server 'sense1' (192.168.100.109:4747): timeout of 5000ms exceeded
```

The error message itself — what went wrong, and with which server — is unchanged.

---

## Where stack traces still appear

| Where | Stack traces? |
|-------|---------------|
| Docker | No |
| Standalone executables | No (as before) |
| Butler SOS started from its source code with Node.js, outside a container | Yes (as before) |
| Crash dump files, written when Butler SOS stops because of an unrecoverable error | Yes (as before) |
| Log level `debug`, for some errors while setting up the InfluxDB connection | Yes (as before) |

There is no setting to turn stack traces back on in Docker. If you are asked for one in a bug
report, the crash dump file is the place to look; see the crash dump settings
(`Butler-SOS.crashFile`).

---

## How Butler SOS knows it runs in Docker

Docker puts a file named `/.dockerenv` in every container it starts, and Butler SOS checks for
it. The result is shown near the top of the log at every start:

```text
info: Running in Docker : true
```

Some other container platforms — Podman, and Kubernetes clusters that run containers without
Docker — do not create that file. There, the line above says `false`, and Butler SOS still logs
stack traces as before.

---

## Related settings

None. The behaviour follows from how Butler SOS is run.
