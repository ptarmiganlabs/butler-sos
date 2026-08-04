# Docs Staging: `to-doc-site`

Files in this folder are the source of truth for updates to the Butler SOS documentation site. They are written, reviewed, and finalized here before being published to the official documentation.

## Purpose

This folder serves as a staging area for documentation that should eventually appear on the Butler SOS doc site `butler-sos.ptarmiganlabs.com`. It is the single place where documentation is authored outside of the doc site's own repository.

## When to write a file

Write the file in the **same pull request as the change it describes**. If the two are separated, the change ships and the doc site never learns about it.

A file is needed whenever the change is visible to someone running Butler SOS:

- A new feature, or a change to how an existing one behaves
- A new, renamed, removed or re-defaulted configuration setting
- A bug fix an administrator would notice — wrong data, or a silent failure that now surfaces
- New or changed log messages, error codes or HTTP status codes an operator might search for
- Anything that changes what an administrator must do when upgrading

No file is needed when the change has no effect an administrator could observe: internal refactoring, test-only changes, CI and tooling work, or dependency bumps that change no behaviour.

When it is unclear whether a change qualifies, write the file. A short note that turns out to be unnecessary costs far less than a behaviour change that reaches users undocumented.

## Audience

Files here should be written for **Butler SOS and Qlik Sense administrators** — not Node.js developers. Assume the reader:

- Is familiar with Qlik Sense and its ecosystem
- Has admin-level access to a Qlik Sense environment
- Understands what Butler SOS does and why they would use it
- May not know what an HTTP API is or how to read a JSON response body
- May be managing Butler SOS in a production environment

When in doubt, err on the side of explaining more rather than less. Use plain language, avoid jargon where simple words suffice, and provide enough context that an admin with no software development background can understand and act on the information.

## File format

- Use Markdown (`.md`)
- One topic per file
- File names should be descriptive and kebab-case (e.g., `audit-api-return-codes.md`)
- Include all information relevant to the doc site in a single file — do not split topics across files or assume readers will cross-reference multiple files
- Do not include internal implementation details (code snippets, internal variable names, file paths in the codebase) unless they are directly relevant to an administrator configuring or operating Butler SOS

## A worked example

`audit-api-rate-limiting.md` in this folder shows the depth and structure expected of a staging file. Use it as the reference when in doubt about how much detail to include or how to organise it.

## Processing status in file names

Files in this folder can also carry a status prefix in their file name:

- Files without a prefix are still pending review or migration to the doc site.
- Files starting with `done_` have already been incorporated into the Butler SOS doc site, or their content has been verified to already exist there.

When marking a file as processed, keep the original file name after the prefix:

- `audit-api-return-codes.md` becomes `done_audit-api-return-codes.md`

Keep processed files in this folder for traceability until there is a deliberate cleanup pass.

## Ownership

These files are maintained by the Butler SOS core team. Pull requests and issues are welcome.