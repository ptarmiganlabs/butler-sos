# Updated Operating-System Packages in the Docker Image

The Butler SOS Docker image is built on Debian Linux. This release moves it to a newer Debian
build, which brings newer versions of the operating-system packages the image is made of. Nothing
changes in how you run or configure the container.

The visible effect is in vulnerability scans: if your organisation scans container images before
running them, this release reports fewer findings than 15.1.0.

---

## What changed in the scan results

A scan of the Butler SOS 15.1.0 image with Trivy reported 24 findings rated HIGH or CRITICAL. In
this release:

| Where the findings were                                                      | 15.1.0 | This release |
| ---------------------------------------------------------------------------- | -----: | -----------: |
| npm's supporting packages (npm is no longer in the image)                    |     11 |            0 |
| `libpcre2-8-0`, a text-matching library that is part of the operating system |      4 |            0 |
| `handlebars`, a template library Butler SOS uses                             |      2 |            0 |
| `perl-base`, the core of the Perl programming language                       |      7 |            7 |
| **Total**                                                                    | **24** |        **7** |

These numbers count only findings for which a fixed version exists. Other scanners, or other scan
settings, may report different totals.

Removing npm is described on its own page: the Docker image no longer includes npm, npx, Corepack
or Yarn.

---

## The findings that remain

The seven remaining findings are all in `perl-base`. Debian installs it in every system as an
essential package; Butler SOS never runs Perl, so none of these can be reached through Butler SOS.

Debian has released a fixed version of `perl-base`, but it was not yet included in the Debian base
image when this release was built. Butler SOS moves to newer Debian base images as they are
published, so a later release is expected to include the fix. Check the release notes of later
versions, or scan the image of a newer release yourself, to confirm.
