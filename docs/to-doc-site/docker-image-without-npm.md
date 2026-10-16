# The Docker Image No Longer Includes npm, npx, Corepack or Yarn

The Butler SOS Docker image no longer contains the Node.js package managers: **npm**, **npx**,
**Corepack** and **Yarn**. Butler SOS itself does not use any of them while it runs, so for most
installations nothing changes: the container starts, runs and reports its health exactly as before.

This page explains why they were removed, and the situations in which you will notice.

---

## Why they were removed

The Docker image used to be built on the official Node.js image, and that image ships with npm,
Corepack and Yarn. They come with their own supporting packages, separate from the ones Butler SOS
uses. Butler SOS installs everything it needs while the image is being built, and never calls a
package manager afterwards — yet all of them were still present in every published image.

That matters when you scan the image for known vulnerabilities, as many organisations do before
running a container. A scan of the Butler SOS 15.1.0 image with Trivy reported 24 findings rated
HIGH or CRITICAL. Eleven of them, one of them CRITICAL, were in npm's own supporting packages
(`tar`, `undici`, `brace-expansion` and `ip-address`), not in Butler SOS. They could not be fixed
by updating Butler SOS, because Butler SOS does not control which versions npm brings along.

The image is now built on Debian Linux directly, and only Node.js itself is added to it. The
package managers are not just hidden: they are not part of the image at all.

---

## What stays the same

- The container's start command and its health check both call Node.js directly, and Node.js is
  still in the image.
- Butler SOS still runs as the user `node`, with user and group ID 1000. Files it writes to
  mounted volumes keep the same ownership as before.
- A command you give the container, in Docker Compose or on the `docker run` command line, is
  handled exactly as before.

---

## What you need to do

Nothing, if you run the Butler SOS container in the usual way — with `docker run`, Docker Compose
or similar — and configure it through its YAML config file.

Check your setup if any of these apply to you, because each now fails with an error saying that
`npm`, `npx` or `yarn` is not found:

- **You build your own image on top of the Butler SOS image.** A Dockerfile that starts with
  `FROM ptarmiganlabs/butler-sos` and then runs `npm install`, `npx` or `yarn` no longer builds.
  Install the extra packages in a separate build stage based on the official Node.js image, and
  copy the result into your image, or ask yourself whether you still need them.
- **You override the container's command.** A Docker Compose `command:`, a Kubernetes `command` or
  `args`, or a `docker run` command line that starts Butler SOS through `npm start`, `npm run` or
  `npx` no longer works. Call Node.js directly instead, for example:

    ```yaml
    command: ['node', 'src/butler-sos.js', '-c', '/nodeapp/config/production.yaml']
    ```

- **You open a shell inside the running container** (for example with `docker exec`) and type
  `npm`, `npx` or `yarn`. If you were doing this for troubleshooting, use `node` instead, which is
  still available:

    ```bash
    docker exec -it butler-sos node --version
    ```

    (Replace `butler-sos` with the name of your container.)
