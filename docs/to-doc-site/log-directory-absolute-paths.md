# Absolute Paths in `logDirectory` Now Work

## Summary

You can now set `logDirectory` to a full path, such as `/var/log/butler-sos` on Linux or
`D:\Logs\Butler SOS` on Windows, and Butler SOS writes its log files to exactly that folder.

Before this fix, Butler SOS added the full path onto the end of its own folder. On Linux and
macOS, log files ended up in an unexpected subfolder of the Butler SOS folder. On Windows, the
result was not a valid folder path at all.

Relative paths, including the default `log`, work exactly as before.

---

## Who this affects

- **You set `logDirectory` to a full path.** Your log files will move to the folder you
  configured. Read [Before you upgrade](#before-you-upgrade).
- **Your `logDirectory` starts with `/` or `\`, but you meant a folder inside the Butler SOS
  folder** (for example `/log`). This now means a folder at the root of the disk. Read
  [Before you upgrade](#before-you-upgrade).
- **You use the default `log`, or another relative path such as `logs/butler-sos`.** Nothing
  changes for you.

---

## What went wrong

Butler SOS always joined `logDirectory` onto its own folder, even when `logDirectory` was
already a full path:

| Butler SOS folder | `logDirectory` | Log files went to (before) | Log files go to (now) |
|---|---|---|---|
| `/opt/butler-sos` | `/var/log/butler-sos` | `/opt/butler-sos/var/log/butler-sos` | `/var/log/butler-sos` |
| `C:\Program Files\Butler SOS` | `D:\Logs\Butler SOS` | `C:\Program Files\Butler SOS\D:\Logs\Butler SOS` (not a valid Windows path) | `D:\Logs\Butler SOS` |
| `/opt/butler-sos` | `log` | `/opt/butler-sos/log` | `/opt/butler-sos/log` (unchanged) |

On Linux and macOS this was easy to miss. Butler SOS created the unexpected subfolder and wrote
its logs there without any error, so the folder you had configured simply stayed empty.

---

## How Butler SOS finds the log folder now

**A full (absolute) path is used exactly as written.**

- Linux and macOS: the path starts with `/`, for example `/var/log/butler-sos`.
- Windows: the path starts with a drive letter, for example `D:\Logs\Butler SOS` or
  `D:/Logs/Butler SOS`. A path that starts with `\` or `/` but has no drive letter, such as
  `\Logs`, is also a full path: it points to that folder at the root of the current drive.

**A relative path starts from the Butler SOS folder.**

- When you run the Butler SOS executable (the usual setup on Windows and Linux servers), a
  relative path starts from the folder that contains the executable. The default `log` means a
  `log` folder next to the executable.
- When Butler SOS is started with Node.js from its source code, a relative path starts from the
  working directory. This is how the official Docker image runs Butler SOS, with `/nodeapp` as the
  working directory, so the default `log` means `/nodeapp/log` inside the container.

**Missing folders are created.** When Butler SOS starts, it creates the log folder and any
missing parent folders.

---

## Configuration examples

### Linux and macOS

```yaml
Butler-SOS:
    fileLogging: true
    logDirectory: /var/log/butler-sos
```

### Windows

Forward slashes work on Windows and avoid every quoting pitfall, so they are the simplest choice:

```yaml
Butler-SOS:
    fileLogging: true
    logDirectory: D:/Logs/Butler SOS
```

Backslashes work too, either without quotes or inside single quotes:

```yaml
    logDirectory: D:\Logs\Butler SOS
```

```yaml
    logDirectory: 'D:\Logs\Butler SOS'
```

**Do not put a Windows path in double quotes.** Inside double quotes, YAML treats a backslash as
the start of a special character code. Depending on the letters after each backslash, Butler SOS
either cannot read the configuration file at all, or silently reads a different path than the
one you wrote:

```yaml
    logDirectory: "D:\Logs\Butler SOS"   # Wrong: the config file fails to load with an "escape sequence" error
    logDirectory: "C:\temp\new-logs"     # Wrong: \t and \n turn into a tab and a line break
```

In the second case, Butler SOS stops during startup with
`Your path or filename contain an invalid character.`

### Docker

Inside a container, every path refers to the container's own file system. The default `log` is
`/nodeapp/log` inside the container, and the sample Docker Compose files map it to a folder on
the host:

```yaml
        volumes:
            - './log:/nodeapp/log'
```

If you set `logDirectory` to a full path instead, mount your volume at that same path inside the
container. Otherwise the log files stay inside the container and are lost when it is removed.

---

## Before you upgrade

1. **Check for a leading slash you did not mean.** Until now, `logDirectory: /log` (or `\log` on
   Windows) behaved like `log`: a folder inside the Butler SOS folder. After the upgrade it means
   a `log` folder at the root of the disk (on Windows, the root of the current drive). If that is
   not what you want, remove the leading slash.

2. **Collect your existing log files.** If you had set a full path, your existing log files are
   in the unexpected subfolder described above, for example `/opt/butler-sos/var/log/butler-sos`.
   After the upgrade, new log files go to the folder you configured. Move or archive the old files
   as needed, then delete the old subfolder. Butler SOS no longer writes there, and its automatic
   removal of log files older than 30 days no longer covers it.

3. **Make sure Butler SOS can create and write to the folder.** The account Butler SOS runs as
   (for example the Windows service account, or the user of a systemd service) needs permission
   to create the folder, if it does not exist yet, and to write files in it. If it cannot, Butler
   SOS stops during startup with an error like this:

   ```
   FATAL: Uncaught exception – writing crash dump… Error: EACCES: permission denied, mkdir '/var/log/butler-sos/'
   ```

   - The folder named in the message is the first one Butler SOS could not create. It may be a
     parent of the folder you configured.
   - The error code depends on the cause. `EACCES` (permission denied) is the most common; a
     read-only disk gives `EROFS` instead.
   - Butler SOS then exits with code 1 and writes a crash dump to its crash dump folder. Under an
     automatic restart policy (Docker `restart: on-failure`, systemd `Restart=on-failure`) it will
     keep restarting and failing until the folder problem is fixed.

---

## Checking where Butler SOS writes its logs

Start Butler SOS with log level `verbose` or `debug`. Either set `logLevel` in the configuration
file, or add `--loglevel verbose` to the command line. Near the start of the output you will see:

```
Log file directory: /var/log/butler-sos
```

This line shows the folder Butler SOS has worked out from your setting. It is written to the
console (or wherever your service manager collects console output), not to the log file itself.

---

## Good to know

- **`~` is not expanded.** `~/logs` does not mean your home folder. It is treated as a relative
  path, and creates a folder literally named `~` inside the Butler SOS folder. Write the full path
  instead.
- **Network shares are untested.** Paths such as `\\server\share\logs` have not been tested as a
  log folder. Use a local folder.
- **Crash dumps follow different rules.** The crash dump folder (`crashFile.crashFileDirectory`) is
  a separate setting. A relative path there starts from the working directory, not from the folder
  containing the executable. Both settings accept full paths.
- **Log file names and retention are unchanged.** Butler SOS writes one file per day, named
  `butler-sos.YYYY-MM-DD.log`, and removes files older than 30 days.

---

## Related settings

| Setting | Template value | Description |
|---|---|---|
| `Butler-SOS.fileLogging` | `true` | Write log files to disk. When `false`, no log files are written. |
| `Butler-SOS.logDirectory` | `log` | Folder for the log files: a relative path or a full path. |
| `Butler-SOS.logLevel` | `info` | Which messages are logged. At `verbose`, `debug` and `silly`, Butler SOS also prints the log folder it uses when it starts. |
