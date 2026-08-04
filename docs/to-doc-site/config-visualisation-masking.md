# Config Visualisation: More Values Are Now Masked

The config visualisation page shows your live Butler SOS configuration in a browser, with
sensitive values replaced by asterisks. That masking has been broadened considerably.

If you have used this page before, you will see more asterisks than you used to. **Nothing about
your configuration has changed** — only what the page chooses to display. Butler SOS reads and
uses every setting exactly as before.

---

## What is masked now that was not before

Previously the page masked a hand-maintained list of specific settings. That list had drifted
behind the configuration schema, so anything added since it was last updated was displayed in
full. Values that were visible in plain text and are now masked include:

- **InfluxDB v3 API token**
- **TLS private-key passphrase for the audit events API**
- **InfluxDB v1 password used by the audit events destination**
- **New Relic ingest API keys**, which are configured as HTTP headers
- **Virtual proxy names** of the Qlik Sense servers being monitored

The rule that replaced the list is broader in two ways.

**It matches on the name of the setting, not on a list of known locations.** Any setting whose
name identifies it as a credential — anything containing *password*, *secret*, *token*, *API
key*, *access key*, *passphrase* or *client secret* — is masked wherever it appears in the
configuration, at any depth. The practical benefit is that a credential added to Butler SOS in a
future release is masked automatically, without anyone having to remember to update this page.

**It masks whole values, not just single entries.** If a credential is held in a list or a
group of related settings, the entire group is masked rather than just the parts that happened
to be recognised.

### Server header values are fully masked

HTTP headers configured for New Relic are now masked in their entirety — both the ones Butler
SOS knows are API keys and any others you have added. Header values are a common place for
credentials to live, and there is no reliable way to tell a credential-bearing header from a
harmless one by looking at its name. Masking all of them is the safe choice.

### Some values are shortened rather than hidden

A number of settings are not credentials but do reveal more about your environment than you may
want in a screenshot shared with a colleague or a support ticket. These show a few leading
characters followed by asterisks — enough to recognise which entry you are looking at, without
publishing the whole value. Host names and IP addresses, MQTT topics, certificate file paths,
InfluxDB organisation and bucket names, and app IDs are handled this way.

---

## What this does not change

- **Butler SOS behaviour is unaffected.** Masking applies only to what this page displays.
- **Log files are separate.** This page is not the only place values can surface; log output has
  its own redaction.
- **Settings that are absent stay absent.** An optional credential you have not configured shows
  as unset, not as a row of asterisks. A page full of masks does not mean values are present.

---

## Important: this page still has no authentication

Masking is a safety net, not access control. **The config visualisation server does not require
a password, token or any other credential.** Anyone who can reach its port gets the page.

Masking substantially reduces what an unauthorised viewer would learn — it is why this change
was made — but the page still discloses the shape of your Butler SOS deployment: which
integrations are enabled, how many Qlik Sense servers are monitored, which destinations receive
data, and partial host names.

Recommendations, in order of effectiveness:

1. **Leave it disabled unless you are actively using it.** Set
   `Butler-SOS.configVisualisation.enable` to `false`. This is the default.
2. **Bind it to an address only trusted operators can reach.** The default,
   `Butler-SOS.configVisualisation.host: localhost`, already restricts it to the Butler SOS
   server itself and should be left alone unless you have a specific reason to change it. If you
   have widened it, consider narrowing it back, or pointing it at an interface on a management
   network rather than one reachable by general users.
3. **Firewall the port** so it is reachable only from specific administrator workstations.

```yaml
Butler-SOS:
    configVisualisation:
        enable: false # Default false. Only enable when you need it.
        host: localhost # Hostname or IP address where the web server will listen. Should be localhost in most cases.
        port: 3100 # Port where the web server will listen. Change if port 3100 is already in use.
        obfuscate: true # Should the config file shown in the web UI be obfuscated?
```

Do not expose this page to a network you do not control, and do not treat masking as making it
safe to do so.

### Keep `obfuscate` set to `true`

Everything on this page describes what happens when `Butler-SOS.configVisualisation.obfuscate`
is `true`, which is the default and the recommended setting.

Setting it to `false` disables masking **entirely**. The page then serves your complete
configuration in plain text — every password, token, API key and passphrase — to anyone who can
reach the port, with no authentication in front of it. The broader masking described on this
page gives you no protection whatsoever when this setting is `false`.

If you have turned it off in the past to see a value the old masking hid, note that this is
exactly the situation the change was meant to remove the need for: read the config file on the
server instead.

---

## If a value you need to see is masked

The page is a convenience for eyeballing a running configuration, not the authoritative record.
Your config file is. If you need to confirm an actual value, read the config file on the Butler
SOS server.

If you find a setting masked that you believe is not sensitive, that is most likely the
name-based rule matching a word such as *token* or *key* in a setting that does not hold a
credential. It is a deliberate trade-off: over-masking costs you a trip to the config file,
whereas under-masking discloses a credential to anyone who can load the page.

---

## Related settings

- `Butler-SOS.configVisualisation.enable` / `host` / `port` — see the config visualisation
  configuration page.
