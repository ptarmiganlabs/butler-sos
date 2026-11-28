# Reading a Config File Error

When Butler SOS starts, it checks its config file before doing anything else. If something in
the file is wrong, it does not start. Instead it prints a report that lists every problem it
found and exits with code 1.

Each problem in the report says three things:

- **which setting** it is about, written the way the setting appears in the YAML file;
- **where** it is in the file, as a line and column;
- **what is wrong and what is allowed** instead.

This page shows what the report looks like, how to read it, and how to fix the most common
mistakes.

---

## What the report looks like

```text
Config file /opt/butler-sos/config/production.yaml has 3 problems:

  line 6, col 5    Butler-SOS.logLevel
                   is "chatty", but must be one of: "error", "warn", "info", "verbose", "debug", "silly".

  line 52, col 9   Butler-SOS.heartbeat.remoteUrll
                   is not a known setting. Did you mean "remoteURL"? "remoteURL" is required.

  line 553, col 9  Butler-SOS.influxdbConfig.port
                   is "8086a", but must be a number.

Fix these and start Butler SOS again. Run with --help for the command-line options.
```

The report has three parts:

1. **A heading** naming the config file that was checked and how many problems were found.
   The full path matters. If Butler SOS is not reading the file you expected, this is where
   you will see it.
2. **One entry per problem**, sorted by line. Problems that have no line of their own, such
   as a problem with the file as a whole, come first. A mistake is reported once, even when
   it breaks more than one rule.
3. **One closing line.** Nothing follows it: no stack trace and no second error message.

### Values that are not shown

A value that is wrong is normally shown in the message, in quotes when it was read as text.
The value of a setting that holds a password, token, key or other credential is never shown,
because the report goes to the log:

```text
  line 567, col 13  Butler-SOS.influxdbConfig.v2Config.token
                    is a secret value (not shown), but must be text.
```

Settings count as credentials by their name (anything containing *password*, *token*,
*secret*, *passphrase*, *API key* and similar), and so do the custom headers sent to Qlik
Sense servers and the New Relic header values. These are the same settings that the config
visualisation page masks.

### Reading one entry

```text
  line 553, col 9  Butler-SOS.influxdbConfig.port
                   is "8086a", but must be a number.
```

- `line 553, col 9` is the position in the file. Most editors can jump straight to a line
  number. The column counts characters from the start of the line, starting at 1, so column 9
  is where the setting's name begins after eight spaces of indentation.
- `Butler-SOS.influxdbConfig.port` is the setting. Each part is one level of indentation in
  the YAML file, so this is the `port` setting inside `influxdbConfig`, inside `Butler-SOS`:

  ```yaml
  Butler-SOS:
      influxdbConfig:
          port: 8086a
  ```

  Entries in a list are numbered from 0. `Butler-SOS.serversToMonitor.servers[1].host` is the
  `host` setting of the *second* server in the `servers` list.
- The text below the setting says what is wrong and what is allowed.

A problem that concerns the whole file, such as a YAML syntax error, has no setting name. Its
entry is just the message.

---

## Common mistakes and how to fix them

### A misspelt setting

```text
  line 52, col 9   Butler-SOS.heartbeat.remoteUrll
                   is not a known setting. Did you mean "remoteURL"? "remoteURL" is required.
```

Setting names are case sensitive, and Butler SOS does not accept settings it does not know.
When the name is close to one that is allowed in the same place, the report suggests it. If
the suggested setting is also a required one, the report says so. The misspelling and the
missing setting are the same mistake, so they are reported as one problem.

**Fix:** correct the spelling on the line given, here to `remoteURL`.

If there is no close match, the report says:

```text
                   is not a known setting. Check the spelling, or remove it.
```

This often means the setting was removed or renamed in a newer version of Butler SOS. Compare
your file with the config file template that ships with the version you are running.

### A value of the wrong type

```text
  line 553, col 9  Butler-SOS.influxdbConfig.port
                   is "8086a", but must be a number.
```

The report shows the value it found, in quotes when it was read as text, and the kind of value
the setting needs:

| The report says it must be | What to write |
| --- | --- |
| a number | `8086`, `0.5` |
| a whole number | `8086` |
| text | `my-server`, or `"my-server"` in quotes |
| true or false | `true` or `false` |
| a list | entries on separate lines, each starting with `- `, or `[]` for an empty list |
| a section of settings | indented settings below the name |
| empty | nothing after the colon |

A common case is a number or a `true`/`false` value in quotes. YAML treats anything in quotes
as text:

```text
  line 553, col 9  Butler-SOS.influxdbConfig.port
                   is "8086", but must be a number. Remove the quotes around it.
```

**Fix:** write `port: 8086`, not `port: "8086"`. In the same way, write `enable: true`, not
`enable: "true"`. Words such as `yes`, `no`, `on` and `off` are not read as true or false
either. Use `true` and `false`.

### A value that is not in the allowed list

```text
  line 6, col 5    Butler-SOS.logLevel
                   is "chatty", but must be one of: "error", "warn", "info", "verbose", "debug", "silly".
```

Some settings take only a fixed set of values. The report lists all of them.

**Fix:** use one of the listed values, exactly as written. These values are case sensitive.

### A missing setting or section

```text
  line 2, col 1    Butler-SOS.fileLogging
                   is missing. Add it under Butler-SOS.
```

A setting that is not in the file has no line of its own. The line given is the line of the
section it belongs in, here the `Butler-SOS:` line at the top of the file.

**Fix:** add the setting inside that section, at the same indentation as the settings around
it. The config file template for your version shows each setting's place and a sensible value.

### A value outside its range, or in the wrong format

```text
  line 205, col 13  Butler-SOS.logEvents.udpServerConfig.serverHost
                    is "<IP or FQDN>", but must be a host name, for example qlik.example.com.

  line 555, col 9   Butler-SOS.influxdbConfig.maxBatchSize
                    is 0, but must be at least 1.
```

The report gives the smallest or largest value allowed, or describes the format expected, with
an example.

**Fix:** change the value to one within the range, or in the format shown. The config file
template has placeholders such as `<IP or FQDN>`. Every one of them must be replaced with a real
value.

### Settings that do not fit together

Some problems are not about one setting on its own, but about two settings that cannot be used
together. They are reported in the same way, after the file itself has passed its check:

```text
Config file /opt/butler-sos/config/production.yaml has 1 problem:

  line 38, col 5  Butler-SOS.anonTelemetry
                  is true, but Butler-SOS.systemInfo.enable is false. Telemetry needs system information: set Butler-SOS.anonTelemetry to false, or Butler-SOS.systemInfo.enable to true.

Fix this and start Butler SOS again. Run with --help for the command-line options.
```

Server tags are checked here too. Every tag listed in
`Butler-SOS.serversToMonitor.serverTagsDefinition` must be set on every server, and a server
may set only tags that are listed there. Every problem of this kind is reported at once, so
after a fix you will not find another one waiting behind it.

---

## YAML syntax errors

If the file is not valid YAML, Butler SOS cannot read any settings from it. It reports one
problem with the position where reading failed and what it expected there, followed by the
lines around that position, with a `^` under the column:

```text
Config file /opt/butler-sos/config/production.yaml has 1 problem:

  line 7, col 5  The file is not valid YAML: bad indentation of a mapping entry.
                 5 |     # ...
                 6 |      logLevel: ...
                 7 |     fileLogging: ...
                   |     ^
                 8 |     logDirectory: ...
                 (Values are left out, because the file may hold passwords.)

Fix this and start Butler SOS again. Run with --help for the command-line options.
```

The excerpt shows the setting names and their indentation, which is what a syntax error is
almost always about, but every value and every comment is replaced by `...`. The report ends
up in the service or container log, and the lines next to the error could hold a password.
Open the file at the line given to see the values.

The most common cause is indentation. YAML uses spaces, and every setting in a section must be
indented by exactly the same number of spaces. Tabs are not allowed. The mistake is often on
the line *before* the one reported. In the example above, `logLevel` has one space too many,
and the reader only notices at the next line.

Other syntax errors you may see:

- **`duplicated mapping key`**: the same setting appears twice in one section. Remove one of
  them.
- **`tab characters must not be used in indentation`**: a tab instead of spaces. Replace it
  with spaces.
- **`end of the stream or a document separator is expected`**: usually a list entry (a line
  starting with `- `) where a setting was expected, or a line indented less than it should be.
- **`unexpected end of the stream within a double quoted scalar`**: a quote that is opened and
  never closed.

---

## Things worth knowing

- **Most sections that are switched off are only checked lightly.** In most sections that
  have an `enable` setting, the other settings are not checked while it is `false`. A misspelt
  setting in a section you are not using yet may only be reported once you enable that
  section.
- **Only the config file given at startup is checked.** Butler SOS checks the file named with
  `-c` or `--configfile`. Settings that come from anywhere else are not part of this report.
- **The exit code is 1.** Docker, systemd and scripts can tell from it that Butler SOS did not
  start. Under an automatic restart policy, a config error therefore shows up as a container or
  service that keeps restarting. Read the first report in the log, fix the file, and restart.
- **`--skip-config-verification` still exists.** It skips these checks completely, and Butler
  SOS then starts on whatever the file contains. That can mean services running with wrong
  settings, or failing later with less helpful errors. Use it only to get past a check you have
  understood and know to be wrong, and report that case so it can be fixed.

### Changed log messages

If you have log alerts or searches built on the old messages, update them. These lines are no
longer printed:

```text
VERIFY CONFIG FILE ERROR: /Butler-SOS/influxdbConfig/port : must be number
VERIFY CONFIG FILE: Error parsing YAML file: ...
MAIN: Config file verification failed. Exiting.
MAIN: Application specific config verification failed. Exiting.
```

Search for `has 1 problem` / `problems:` or `Fix this and start Butler SOS again` /
`Fix these and start Butler SOS again` instead. The success message is unchanged:

```text
VERIFY CONFIG FILE: Your config file at /opt/butler-sos/config/production.yaml is correctly formatted, good work!
```
