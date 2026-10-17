# Clearer Errors When Butler SOS Cannot Find Its Config File

Butler SOS cannot run without a config file, which you point it at with the `-c` (or
`--configfile`) option. Two startup errors around this have become clearer: starting without
the option at all, and pointing it at a file that does not exist.

If it is started without a config file, it now:

1. **Prints an error saying the config file is missing**, after the usual help text.
2. **Exits with code 1**, so Docker, systemd and scripts can tell that it did not start.

Previously it printed the help text, gave no reason, and exited with code 0 — "finished
normally". That looked like Butler SOS refusing to start for no visible reason, and restart
policies and monitoring treated it as a clean exit.

---

## What you will see

The help text is shown as before, followed by the error, framed so it is easy to spot at the
end of the help text:

```text
================================================================
Error: No config file specified.
Use -c <file> or --configfile <file> to point Butler SOS at one.
================================================================
```

In a terminal that supports colour, the frame and the first line of the error are shown in red.
Colour is left out when the output goes to a log file, a pipe or a container log, and when the
`NO_COLOR` environment variable is set, so logs contain plain text only.

The help text and the error are both written to standard error rather than standard output.
`--help` and `--version` are unchanged: they still print to standard output and exit with
code 0.

---

## The most common cause: running Butler SOS through npm

If you run Butler SOS from a copy of the source code with npm, this command looks right but
does not work:

```bash
npm run butler-sos -c src/config/production.yaml
```

npm has its own `-c` option, so it keeps `-c` and the file name for itself and starts Butler
SOS with no options at all. Butler SOS never sees the config file.

Butler SOS now recognises this case and says so:

```text
===================================================================
Error: No config file specified.
Use -c <file> or --configfile <file> to point Butler SOS at one.

npm read "-c src/config/production.yaml" as one of its own options,
so the config file never reached Butler SOS.
Add -- after the script name to pass options on to Butler SOS:
  npm run butler-sos -- -c src/config/production.yaml
===================================================================
```

The `--` tells npm that everything after it belongs to Butler SOS. The same applies to every
other Butler SOS option, such as `--loglevel`:

```bash
npm run butler-sos -- -c src/config/production.yaml --loglevel debug
```

Running Node.js directly avoids npm altogether:

```bash
node src/butler-sos.js -c src/config/production.yaml
```

The standalone Butler SOS executables and the Docker image do not go through npm, so they are
not affected by this.

---

## When the config file does not exist

If the `-c` option points at a file that is not there, Butler SOS used to say only
`Error: Specified config file does not exist`, without saying where it had looked. It now names
the full path it tried:

```text
Error: Config file does not exist: /opt/butler-sos/src/config/production.yaml
"src/config/production.yaml" was resolved from the current directory, /opt/butler-sos
```

The second line appears only when the path you gave is relative. A relative path is looked up
from the directory Butler SOS was started in, not from where the Butler SOS program itself is
installed. Starting it from a different directory — a service manager, a scheduled task, or a
shortcut with a different working directory — is the usual reason a config file that plainly
exists is reported as missing. Use an absolute path in service definitions to rule this out.

This error is now written to standard error rather than standard output, and Butler SOS exits
with code 1, as before.

---

## Docker and systemd

The Butler SOS Docker image does not include a config file option in its default command. A
container started without one — for example, a Docker Compose file whose `command:` line is
missing or misspelled — now exits with code 1 and the error above appears in the container log.

Under a restart policy such as Docker's `restart: on-failure` or systemd's
`Restart=on-failure`, the container or service will restart and fail again until the config
file option is added. That restart loop is intended: it makes a setup that can never start
visible, instead of leaving Butler SOS quietly stopped. Check the log, add the `-c` option, and
the loop stops.

To limit how often a permanently broken setup is retried, give the restart policy a maximum
retry count (Docker: `restart: on-failure:5`; systemd: `StartLimitBurst` and
`StartLimitIntervalSec`).
