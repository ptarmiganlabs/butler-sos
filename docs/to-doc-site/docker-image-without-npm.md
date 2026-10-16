# The Docker Image No Longer Includes npm

The Butler SOS Docker image no longer contains **npm** or **npx**, the Node.js package manager
and its companion command. Butler SOS itself does not use either of them while it runs, so for
almost everyone nothing changes: the container starts, runs and reports its health exactly as
before.

This page explains why they were removed, and the one situation in which you might notice.

---

## Why they were removed

The Docker image is built on the official Node.js image, and that image ships with npm. npm
comes with its own set of supporting packages, separate from the ones Butler SOS uses. Butler SOS
installs everything it needs while the image is being built, and never calls npm afterwards — yet
npm and its packages were still present in every published image.

That matters when you scan the image for known vulnerabilities, as many organisations do before
running a container. A scan of the Butler SOS 15.1.0 image with Trivy reported 24 findings rated
HIGH or CRITICAL. Eleven of them, one of them CRITICAL, were in npm's own supporting packages
(`tar`, `undici`, `brace-expansion` and `ip-address`), not in Butler SOS. They could not be fixed
by updating Butler SOS, because Butler SOS does not control which versions npm brings along.

Removing npm removes those findings, and removes a set of software that Butler SOS never ran.

---

## What you need to do

Nothing, if you run the Butler SOS container in the usual way — with `docker run`, Docker Compose
or similar — and configure it through its YAML config file. The container's start command and
its health check both call Node.js directly, and Node.js is still in the image.

You will only notice if you open a shell inside the running container (for example with
`docker exec`) and type `npm` or `npx`. Those commands now report that they are not found. If you
were doing this for troubleshooting, use `node` instead, which is still available:

```bash
docker exec -it butler-sos node --version
```

(Replace `butler-sos` with the name of your container.)
