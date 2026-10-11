# The Windows Executable Is Digitally Signed Again

The Windows version of Butler SOS, `butler-sos.exe` in the Windows zip file of each release, is
once again **digitally signed by Ptarmigan Labs AB**. The releases from 15.0.0 up to this change
shipped an executable with no signature at all.

Nothing about how Butler SOS runs or is configured changes. What changes is how Windows, and the
security tools on your servers, treat the file when you download and start it.

---

## Why a signature matters

A digital signature tells Windows two things: who published the file, and that it has not been
altered since it was signed. Without one, Windows and many security products treat a program
with suspicion:

- **Windows SmartScreen** may show "Windows protected your PC" when the file is first started,
  and require an extra click to run it.
- **Antivirus and endpoint protection** products are more likely to quarantine or block an
  unsigned program, especially one that opens network connections, as Butler SOS does.
- **Application control policies** (AppLocker, Windows Defender Application Control and similar)
  often allow software by its publisher. An unsigned program has no publisher to allow, so it
  had to be allowed some other way, or not at all.

With the signature back, `butler-sos.exe` identifies itself as published by Ptarmigan Labs AB.

---

## How to check the signature

**In Windows Explorer:** right-click `butler-sos.exe`, choose **Properties**, and open the
**Digital Signatures** tab. The list should show **Ptarmigan Labs AB**. Select it and click
**Details**; Windows should report that the digital signature is OK.

**In PowerShell:**

```powershell
Get-AuthenticodeSignature .\butler-sos.exe | Format-List Status, SignerCertificate
```

`Status` should be `Valid`, and the signer certificate should name `CN=Ptarmigan Labs AB`. The
certificate is issued through Microsoft's identity-verified code-signing service, and the
signature carries a timestamp, so it remains valid after the certificate itself expires.

**Optionally, check where the file was built.** Each signed Windows executable also has a
published record showing that it was built and signed by Butler SOS's own release process on
GitHub, from the source code of that release. With the GitHub command-line tool (`gh`) installed
and signed in to a GitHub account, you can check a downloaded copy against that record:

```bash
gh attestation verify butler-sos.exe --repo ptarmiganlabs/butler-sos
```

---

## What you need to do

Nothing, in most cases. Download and install Butler SOS exactly as before.

If your organisation controls which programs may run:

- **Allowed by publisher:** you can now allow Butler SOS by its publisher, Ptarmigan Labs AB,
  instead of by a file-specific rule.
- **Allowed by file hash:** the hash changes with every release, signed or not, so update the
  rule for each new version as you did before.
