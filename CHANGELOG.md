# Changelog

## [11.0.1](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v11.0.0...butler-sos-v11.0.1) (2024-09-20)


### Bug Fixes

* Remove leftover references to Postgress log db in the code ([1c3fbcc](https://github.com/ptarmiganlabs/butler-sos/commit/1c3fbcc147d1eef3e72a778d3783a99dca582a6e))


### Miscellaneous

* Remove Postgress dependency, as log db support has been discontinued ([94aea42](https://github.com/ptarmiganlabs/butler-sos/commit/94aea424416039afba0b6b3eb25f5d07aabc5543))


### Documentation

* Update README file badges ([0eb42c1](https://github.com/ptarmiganlabs/butler-sos/commit/0eb42c14f73e3d7778f62d24b55e95f9d4eb954e))

## [11.0.0](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v10.2.1...butler-sos-v11.0.0) (2024-09-20)


### ⚠ BREAKING CHANGES

* **log-db:** Remove support for getting logs from Sense log db
* **config:** Make naming of InfluxDB tags consistent across entire config file

### Features

* **qix performance:** Add fine-grained performance monitoring for app objects ([818c702](https://github.com/ptarmiganlabs/butler-sos/commit/818c702a791f983506eb7d2c038e2f930b0b6299)), closes [#320](https://github.com/ptarmiganlabs/butler-sos/issues/320)
* **qs-event:** Categorise events from Qlik Sense as user created or automated ([9c1bb5b](https://github.com/ptarmiganlabs/butler-sos/commit/9c1bb5bf2ec9f34a03c2ba80025ec408c6a856a0)), closes [#889](https://github.com/ptarmiganlabs/butler-sos/issues/889)
* **qs-events:** Add counters for incoming Qlik Sense events ([e8d8a13](https://github.com/ptarmiganlabs/butler-sos/commit/e8d8a13e37ecafe3aa9a72b369619a62c3e26e40)), closes [#884](https://github.com/ptarmiganlabs/butler-sos/issues/884)


### Bug Fixes

* **config-vis:** Cosmetic changes to config visualisation web page ([5285967](https://github.com/ptarmiganlabs/butler-sos/commit/52859670d4f2a7e8827f321f856b442aa15a2d2f))
* **config:** Make naming of InfluxDB tags consistent across entire config file ([0ed25d5](https://github.com/ptarmiganlabs/butler-sos/commit/0ed25d576cc19dc9368999a8a9ec170d3b7fb62a)), closes [#890](https://github.com/ptarmiganlabs/butler-sos/issues/890)
* **config:** Validate hostname, url and pasword fields in config file. ([4a7671e](https://github.com/ptarmiganlabs/butler-sos/commit/4a7671e0cc97e123531f8c5fb515c8727b1a3e2f))
* **docker:** Update sample docker-compose file wrt Butler SOS 11.0 ([7336fb7](https://github.com/ptarmiganlabs/butler-sos/commit/7336fb7881b2016ab8ec1c26b00ed3018c797191))


### Miscellaneous

* **deps:** Update dependencies ([6c4e02f](https://github.com/ptarmiganlabs/butler-sos/commit/6c4e02f0cc86e1010ef065b5cd40a01135ee9cef))


### Refactoring

* **log-db:** Remove support for getting logs from Sense log db ([6e7043b](https://github.com/ptarmiganlabs/butler-sos/commit/6e7043b7696744be61c1cfc5e774d9f3f2765e55)), closes [#860](https://github.com/ptarmiganlabs/butler-sos/issues/860)
* Make config file verification more robust ([9be5d8a](https://github.com/ptarmiganlabs/butler-sos/commit/9be5d8a56028c8884f4cec384e5703c43509651e)), closes [#902](https://github.com/ptarmiganlabs/butler-sos/issues/902)


### Documentation

* Minor tweak ([2c1ffd3](https://github.com/ptarmiganlabs/butler-sos/commit/2c1ffd3d6aa4782f47a0a21783ff90a5957a5257))

## [10.2.1](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v10.2.0...butler-sos-v10.2.1) (2024-08-28)


### Bug Fixes

* **config-vis:** Obfuscate host name of config visualisation server ([f76db6b](https://github.com/ptarmiganlabs/butler-sos/commit/f76db6bd34363e9a476119532757b25586ebb49f)), closes [#869](https://github.com/ptarmiganlabs/butler-sos/issues/869)
* **sense-events:** Better handling of unknown UDP messages ([d122863](https://github.com/ptarmiganlabs/butler-sos/commit/d122863cac529f5c7cc2865b766f7c4a33f468ee)), closes [#880](https://github.com/ptarmiganlabs/butler-sos/issues/880)


### Miscellaneous

* **deps:** Update config vis library to latest version ([ae49d81](https://github.com/ptarmiganlabs/butler-sos/commit/ae49d81032b40bb8606494920c84be57813175f9))
* **deps:** Update dependencies ([adffeda](https://github.com/ptarmiganlabs/butler-sos/commit/adffedab62ce05d02d876844e1ace163b99f9e20))

## [10.2.0](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v10.1.1...butler-sos-v10.2.0) (2024-08-20)


### Features

* **config:** Show info at startup whether Docker is used or not ([aff1855](https://github.com/ptarmiganlabs/butler-sos/commit/aff185589dd6a01b457c8db5328ced5386ae0daa)), closes [#861](https://github.com/ptarmiganlabs/butler-sos/issues/861)
* **config:** Visualise obfuscated config file in Butler SOS hosted web page ([2b067c8](https://github.com/ptarmiganlabs/butler-sos/commit/2b067c8e4cdb858506c88710cb33200f39fec1b8)), closes [#858](https://github.com/ptarmiganlabs/butler-sos/issues/858)
* **logs:** Add catgegorisation of Qlik Sense log events ([3fbdccf](https://github.com/ptarmiganlabs/butler-sos/commit/3fbdccff226d5a04806b4aa415f720249178687b)), closes [#849](https://github.com/ptarmiganlabs/butler-sos/issues/849)


### Bug Fixes

* **config:** Better config file verification (and exit app when incorrect) ([510a583](https://github.com/ptarmiganlabs/butler-sos/commit/510a583d7a2e38b0c236c44bdd3c3f950a32cad0)), closes [#857](https://github.com/ptarmiganlabs/butler-sos/issues/857)
* **config:** More thorough verification of config file structure ([bb46e00](https://github.com/ptarmiganlabs/butler-sos/commit/bb46e0078f66b41f4d19bc34ba21614e7c56d990)), closes [#857](https://github.com/ptarmiganlabs/butler-sos/issues/857)
* **new-relic:** Allow empty static uptime attributes w/o errors ([c2b1579](https://github.com/ptarmiganlabs/butler-sos/commit/c2b1579371bb2044d8dca593d0fc44abc757b962)), closes [#863](https://github.com/ptarmiganlabs/butler-sos/issues/863)
* **new-relic:** Better error messages when there is no New Relic config, but NR features are enabled ([d937208](https://github.com/ptarmiganlabs/butler-sos/commit/d9372084cbf51eb7a5519d9c2d66d05b3cee5347)), closes [#863](https://github.com/ptarmiganlabs/butler-sos/issues/863)


### Miscellaneous

* **deps:** Update dependencies ([8ca9558](https://github.com/ptarmiganlabs/butler-sos/commit/8ca955894651c456dc7f651acdcee86c8c4a5ebf))
* Major update - refactored entire code base from CJS &gt; ESM ([ae4083b](https://github.com/ptarmiganlabs/butler-sos/commit/ae4083b33e77303076f6a4b3e780d4e01a115afd)), closes [#859](https://github.com/ptarmiganlabs/butler-sos/issues/859)

## [10.1.1](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v10.1.0...butler-sos-v10.1.1) (2024-08-15)


### Bug Fixes

* **influxdb:** Double quote app names in in-memory-apps-lists ([a7dbb05](https://github.com/ptarmiganlabs/butler-sos/commit/a7dbb05ab3fba852838e77e40ca6a46277cc1f8f)), closes [#843](https://github.com/ptarmiganlabs/butler-sos/issues/843)


### Miscellaneous

* **deps:** Update dependencies ([a32e32c](https://github.com/ptarmiganlabs/butler-sos/commit/a32e32c7cdd218215e8c2878e928d1a271d5d6f1))
* **deps:** update docker/build-push-action action to v6 ([cbe758e](https://github.com/ptarmiganlabs/butler-sos/commit/cbe758e9ea2d0826225a53e3c413eb513f73379c))

## [10.1.0](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v10.0.0...butler-sos-v10.1.0) (2024-06-04)


### Features

* **config:** Verify server tags when Butler SOS starts ([a30c34b](https://github.com/ptarmiganlabs/butler-sos/commit/a30c34b3e300eaf0d551d2c2afcf63f66e0b4edf)), closes [#815](https://github.com/ptarmiganlabs/butler-sos/issues/815)


### Bug Fixes

* **influxdb:** Flush data to InfluxDB v2 every 5 seconds ([2384b6c](https://github.com/ptarmiganlabs/butler-sos/commit/2384b6cb20325b0085335a5563dbaf8be22ffccd))
* **influxdb:** Storing proxy session data in InfluxDB v1 works again ([45312d7](https://github.com/ptarmiganlabs/butler-sos/commit/45312d7e565c07381c7c149361c8a7c9d240085b)), closes [#816](https://github.com/ptarmiganlabs/butler-sos/issues/816)
* **telemetry:** Update telemetry data to reflect current config options ([1ba4391](https://github.com/ptarmiganlabs/butler-sos/commit/1ba4391df5fca5d20aaed587adad7097c4beb143)), closes [#813](https://github.com/ptarmiganlabs/butler-sos/issues/813)

## [10.0.0](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v9.10.3...butler-sos-v10.0.0) (2024-06-03)


### ⚠ BREAKING CHANGES

* Added support for InfluxDB v2, config file format has changed

### Bug Fixes

* **config:** Allow empty arrays in config file ([df98478](https://github.com/ptarmiganlabs/butler-sos/commit/df984789331ec86a0bba158df60ae68717ab0509))
* **config:** Make template YAML config file easier to get started with by commenting out all optional array values ([a26d0f0](https://github.com/ptarmiganlabs/butler-sos/commit/a26d0f01ef9e276d29bbb918ae182d62f4743c88)), closes [#808](https://github.com/ptarmiganlabs/butler-sos/issues/808)
* **log-event:** Make handling of log and user events sent from QS server more robust ([45822c5](https://github.com/ptarmiganlabs/butler-sos/commit/45822c5a330c312b831605e06a3839ff5794be80)), closes [#806](https://github.com/ptarmiganlabs/butler-sos/issues/806)
* **log-events:** Ensure only QS engine messages are forwarded as qseow-engine messages to Butler SOS ([9dcc328](https://github.com/ptarmiganlabs/butler-sos/commit/9dcc3287cbfd08d315124357b6244d4043eff6dd)), closes [#805](https://github.com/ptarmiganlabs/butler-sos/issues/805)
* **logdb:** Don't set up log db data structures if that feature is disabled in config file ([153ad9d](https://github.com/ptarmiganlabs/butler-sos/commit/153ad9dc2ab3febee3623e4bdc678ec53754f120))
* **startup:** Add 5 second delay during startup to make that phase more robust ([4e75727](https://github.com/ptarmiganlabs/butler-sos/commit/4e757273885b575bc93c0db9f088074e3aef9122))
* **startup:** Make indentation of startup info consistent ([0d70f52](https://github.com/ptarmiganlabs/butler-sos/commit/0d70f52d4b5e76882aa4dd9d629d59b29038202e)), closes [#761](https://github.com/ptarmiganlabs/butler-sos/issues/761)
* **uptime:** Round uptime seconds value to whole seconds ([16097a0](https://github.com/ptarmiganlabs/butler-sos/commit/16097a0cae9ed5f2bb99da25999d5c2284cf9bc1)), closes [#807](https://github.com/ptarmiganlabs/butler-sos/issues/807)


### Miscellaneous

* **deps:** Update dependencies ([95be9a0](https://github.com/ptarmiganlabs/butler-sos/commit/95be9a0f0ad3c1df138c494d5f1b6674a504d2d7))
* **deps:** Update dependencies ([a56f5a7](https://github.com/ptarmiganlabs/butler-sos/commit/a56f5a79b8359499f075c8b0d18c3f688cadb2bb))
* **deps:** Update dependencies to stay safe and secure ([e7ba150](https://github.com/ptarmiganlabs/butler-sos/commit/e7ba150c0c79e6df9f055297cc6a5c139d88b142))


### Refactoring

* **config:** Remove support for old config file formats now that all config file settings are mandatory ([350f57c](https://github.com/ptarmiganlabs/butler-sos/commit/350f57ca8d1b5d12d3b5c262fe819f44cdfa9b0b))
* Remove support for old, long deprecated config file formats ([1d6989e](https://github.com/ptarmiganlabs/butler-sos/commit/1d6989e221e9b51eafe4e989eddab349e313e4c3))


### Documentation

* Added support for InfluxDB v2, config file format has changed ([97e5faa](https://github.com/ptarmiganlabs/butler-sos/commit/97e5faae2f0d9cec86364702f03be7ad153e9db3))

## [9.10.3](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v9.10.2...butler-sos-v9.10.3) (2024-04-09)


### Bug Fixes

* Fix broken Linux build ([8a8e160](https://github.com/ptarmiganlabs/butler-sos/commit/8a8e160be3beb14b8d6513abba1e5ab153bd914c))

## [9.10.2](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v9.10.1...butler-sos-v9.10.2) (2024-04-09)


### Bug Fixes

* Fix broken Docker image build ([2c3a291](https://github.com/ptarmiganlabs/butler-sos/commit/2c3a291bf7c2d812ac296e8de5c461c4cb90db0a))
* Fix incorrect zip file names for pre-compiled binaries ([f506ce1](https://github.com/ptarmiganlabs/butler-sos/commit/f506ce1e5fc254411ce9bff184fe634328b89b18))
* Supress experimental/deprecated warnings on startup ([e2090a7](https://github.com/ptarmiganlabs/butler-sos/commit/e2090a76ff9426cc32ca0b139cda5808b2ef48ae)), closes [#762](https://github.com/ptarmiganlabs/butler-sos/issues/762)


### Miscellaneous

* **master:** release butler-sos 9.10.1 ([6c7b297](https://github.com/ptarmiganlabs/butler-sos/commit/6c7b297c9456994c75485ac0e2813287086c8a66))

## [9.10.1](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v9.10.1...butler-sos-v9.10.1) (2024-04-09)


### Bug Fixes

* Debugging release-please ([03759e5](https://github.com/ptarmiganlabs/butler-sos/commit/03759e5cd0971ffaddf72cb52308f148ae359d84))
* Fix incorrect zip file names for pre-compiled binaries ([f506ce1](https://github.com/ptarmiganlabs/butler-sos/commit/f506ce1e5fc254411ce9bff184fe634328b89b18))


### Miscellaneous

* Add defender-for-devops code scanning ([cfd29f3](https://github.com/ptarmiganlabs/butler-sos/commit/cfd29f307f9634b213f2bfaf7dde36afa7168b03))
* Configure scheduled Snaky code scanning ([518bffd](https://github.com/ptarmiganlabs/butler-sos/commit/518bffd70613a0032cab4d47a299b2b898d6b0fd))
* Debug MS Defender code scanning ([179a1df](https://github.com/ptarmiganlabs/butler-sos/commit/179a1df593e9d13cc6233ccd4b36f3423e73168e))
* Debugging release-please ([ba8b1ec](https://github.com/ptarmiganlabs/butler-sos/commit/ba8b1ec1b64bec9f2bc4ae24d6a76984858bd567))
* Debugging release-please... ([493dd3a](https://github.com/ptarmiganlabs/butler-sos/commit/493dd3a5086186c63279c166d02f8f8f8142bb76))
* **deps:** Update dependencies ([03b8118](https://github.com/ptarmiganlabs/butler-sos/commit/03b811800cc6b26f1075552f812acf4fba14a3a3))
* Disable MS Defender for DevOps action due to Node 16 no longer supported by GHA ([9cbe018](https://github.com/ptarmiganlabs/butler-sos/commit/9cbe018ac5d6cee30b88f09a68a99fad39cf8f94))
* Fix GH Actions triggers ([1e0d0d6](https://github.com/ptarmiganlabs/butler-sos/commit/1e0d0d690f260f03d4720ffdb8ea28d93a344505))
* Make insiders build more robust ([890962c](https://github.com/ptarmiganlabs/butler-sos/commit/890962c2c7388b0ceae0082d1ee18338848a9245))
* **master:** release butler-sos 9.10.1 ([40d759a](https://github.com/ptarmiganlabs/butler-sos/commit/40d759ac3a3f1103ea33e4c8995fb7a2195d9ba0))
* Rename code quality GH action ([e8dc094](https://github.com/ptarmiganlabs/butler-sos/commit/e8dc094fab6d734ed4c15d26f29fee712bcc78e5))
* Update MS Defender code scanning GH Action ([c80f239](https://github.com/ptarmiganlabs/butler-sos/commit/c80f239a433fe6f8a56255004c2a110e4c175704))
* Update Snyk config ([ed36d1d](https://github.com/ptarmiganlabs/butler-sos/commit/ed36d1d2e615002a1efce22b3a77a3eefe877fc8))

## [9.10.1](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v9.10.0...butler-sos-v9.10.1) (2024-04-09)


### Bug Fixes

* Debugging release-please ([03759e5](https://github.com/ptarmiganlabs/butler-sos/commit/03759e5cd0971ffaddf72cb52308f148ae359d84))


### Miscellaneous

* Add defender-for-devops code scanning ([cfd29f3](https://github.com/ptarmiganlabs/butler-sos/commit/cfd29f307f9634b213f2bfaf7dde36afa7168b03))
* Configure scheduled Snaky code scanning ([518bffd](https://github.com/ptarmiganlabs/butler-sos/commit/518bffd70613a0032cab4d47a299b2b898d6b0fd))
* Debug MS Defender code scanning ([179a1df](https://github.com/ptarmiganlabs/butler-sos/commit/179a1df593e9d13cc6233ccd4b36f3423e73168e))
* Debugging release-please ([ba8b1ec](https://github.com/ptarmiganlabs/butler-sos/commit/ba8b1ec1b64bec9f2bc4ae24d6a76984858bd567))
* Debugging release-please... ([493dd3a](https://github.com/ptarmiganlabs/butler-sos/commit/493dd3a5086186c63279c166d02f8f8f8142bb76))
* **deps:** Update dependencies ([03b8118](https://github.com/ptarmiganlabs/butler-sos/commit/03b811800cc6b26f1075552f812acf4fba14a3a3))
* Disable MS Defender for DevOps action due to Node 16 no longer supported by GHA ([9cbe018](https://github.com/ptarmiganlabs/butler-sos/commit/9cbe018ac5d6cee30b88f09a68a99fad39cf8f94))
* Fix GH Actions triggers ([1e0d0d6](https://github.com/ptarmiganlabs/butler-sos/commit/1e0d0d690f260f03d4720ffdb8ea28d93a344505))
* Make insiders build more robust ([890962c](https://github.com/ptarmiganlabs/butler-sos/commit/890962c2c7388b0ceae0082d1ee18338848a9245))
* Rename code quality GH action ([e8dc094](https://github.com/ptarmiganlabs/butler-sos/commit/e8dc094fab6d734ed4c15d26f29fee712bcc78e5))
* Update MS Defender code scanning GH Action ([c80f239](https://github.com/ptarmiganlabs/butler-sos/commit/c80f239a433fe6f8a56255004c2a110e4c175704))
* Update Snyk config ([ed36d1d](https://github.com/ptarmiganlabs/butler-sos/commit/ed36d1d2e615002a1efce22b3a77a3eefe877fc8))

## [9.10.0](https://github.com/ptarmiganlabs/butler-sos/compare/v9.9.1...v9.10.0) (2024-02-17)


### Features

* Configurable headers when getting health data from Sense ([a4a27dd](https://github.com/ptarmiganlabs/butler-sos/commit/a4a27ddc3698242153f4e0072aa91022932a7366)), closes [#720](https://github.com/ptarmiganlabs/butler-sos/issues/720)

## [9.9.1](https://github.com/ptarmiganlabs/butler-sos/compare/v9.9.0...v9.9.1) (2024-02-17)


### Bug Fixes

* Version debuggig ([6c0b6ea](https://github.com/ptarmiganlabs/butler-sos/commit/6c0b6ea0dbde02a090ad6fccf62ed39b09f8f540))

## [9.9.0](https://github.com/ptarmiganlabs/butler-sos/compare/v9.8.0...v9.9.0) (2024-02-17)


### Miscellaneous Chores

* release 9.9.0 ([96fbbc9](https://github.com/ptarmiganlabs/butler-sos/commit/96fbbc9ae811c59e8d593f310502373773349dec))

## [9.8.0](https://github.com/ptarmiganlabs/butler-sos/compare/v9.7.1...v9.8.0) (2023-12-14)


### Features

* **config:** Include sample config file in release ZIP ([4c650d7](https://github.com/ptarmiganlabs/butler-sos/commit/4c650d74ccbd9f48b3ef234a6328b2235f4f8bbf)), closes [#689](https://github.com/ptarmiganlabs/butler-sos/issues/689)
* **influxdb:** Store Butler SOS version as tag when storing uptime data ([28e7878](https://github.com/ptarmiganlabs/butler-sos/commit/28e78789c122ad4feb636a41f9e26710f2f32454)), closes [#688](https://github.com/ptarmiganlabs/butler-sos/issues/688)


### Miscellaneous

* **deps:** Update dependencies ([27a892e](https://github.com/ptarmiganlabs/butler-sos/commit/27a892e1c53b774954bd0bb20ad2c4d55914cba7))

## [9.7.1](https://github.com/ptarmiganlabs/butler-sos/compare/v9.7.0...v9.7.1) (2023-11-28)


### Bug Fixes

* Write to InfluxDB even when there is no app ID present ([b92cd2d](https://github.com/ptarmiganlabs/butler-sos/commit/b92cd2d8db761448606a7932ada0dabc22f68c2c)), closes [#678](https://github.com/ptarmiganlabs/butler-sos/issues/678)


### Miscellaneous

* Add shell script to send test user events ([958236e](https://github.com/ptarmiganlabs/butler-sos/commit/958236ed2efcd816036d574b9d0984f006755bfa))
* **deps:** Update dependencies ([dd494a4](https://github.com/ptarmiganlabs/butler-sos/commit/dd494a4703e6e99568b318ba7e1bf5e84e1289a3))

## [9.7.0](https://github.com/ptarmiganlabs/butler-sos/compare/v9.6.4...v9.7.0) (2023-11-26)


### Features

* **user-event:** Add app id/name to user event logging ([5298866](https://github.com/ptarmiganlabs/butler-sos/commit/5298866939e913eb76d425fe6dcabf2cd6ddbd26)), closes [#674](https://github.com/ptarmiganlabs/butler-sos/issues/674)
* **user-event:** Add browser & OS info to user events ([396b76d](https://github.com/ptarmiganlabs/butler-sos/commit/396b76df1f631949957c381ca2e5c2dab03043c5)), closes [#673](https://github.com/ptarmiganlabs/butler-sos/issues/673)

## [9.6.4](https://github.com/ptarmiganlabs/butler-sos/compare/v9.6.3...v9.6.4) (2023-11-25)


### Bug Fixes

* Change default Influxdb config settings to avoid startup warning ([7e9ef40](https://github.com/ptarmiganlabs/butler-sos/commit/7e9ef40b04c1a29daffdf3d64a2b02d68b8a5443))


### Miscellaneous

* **deps:** Bump setup-node to v4 ([8bda3b0](https://github.com/ptarmiganlabs/butler-sos/commit/8bda3b0ac27a2c21ff3579a87f53a47725e9283c))
* **deps:** Update dependencies to stay safe and secure ([684417a](https://github.com/ptarmiganlabs/butler-sos/commit/684417a599792c65d8e535b8ddd8ca251082b48c))
* **deps:** Update deps Snyk and Prettier ([ae5bc0c](https://github.com/ptarmiganlabs/butler-sos/commit/ae5bc0c976a72c6280cccc62d3a154363b00540b))
* Switch to Node 20 ([a4bf1bf](https://github.com/ptarmiganlabs/butler-sos/commit/a4bf1bf7788661c840615900bd8a5d14cef776a5))

## [9.6.3](https://github.com/ptarmiganlabs/butler-sos/compare/v9.6.2...v9.6.3) (2023-09-23)


### Bug Fixes

* **deps:** update dependency eslint to v8.50.0 ([bb15f73](https://github.com/ptarmiganlabs/butler-sos/commit/bb15f73c4c93343a321e5bf36389cd1c467f0951))


### Miscellaneous

* **deps:** update actions/checkout action to v4 ([d4906ab](https://github.com/ptarmiganlabs/butler-sos/commit/d4906abfaf9a3e491ef0bace568dce2b1c9d34fd))
* **deps:** update crazy-max/ghaction-virustotal action to v4 ([7e18183](https://github.com/ptarmiganlabs/butler-sos/commit/7e18183fc6c1911a61527e19c751759200fdcad5))
* **deps:** Update dependencies ([750790d](https://github.com/ptarmiganlabs/butler-sos/commit/750790d79310dbf51f8707fa9831775ca8b5381e))
* **deps:** update docker/build-push-action action to v5 ([52b8773](https://github.com/ptarmiganlabs/butler-sos/commit/52b8773662ab782ca02314e7a57faae24a9a8a9f))
* **deps:** update docker/login-action action to v3 ([9693cc9](https://github.com/ptarmiganlabs/butler-sos/commit/9693cc9a711e179a02a1af8af4671b12ebf69ee7))
* **deps:** update docker/metadata-action action to v5 ([18c3934](https://github.com/ptarmiganlabs/butler-sos/commit/18c3934282933d588e7771b9d33a706f3d3ce7de))
* **deps:** update docker/setup-buildx-action action to v3 ([a3dc2c2](https://github.com/ptarmiganlabs/butler-sos/commit/a3dc2c2aff78ceff761045ad3e156a0c13844886))
* **deps:** update docker/setup-qemu-action action to v3 ([eae1706](https://github.com/ptarmiganlabs/butler-sos/commit/eae1706399bfc18b654af3b50a135f2e2790edeb))

## [9.6.2](https://github.com/ptarmiganlabs/butler-sos/compare/v9.6.1...v9.6.2) (2023-08-22)


### Bug Fixes

* Add missing entries to template config file ([d850543](https://github.com/ptarmiganlabs/butler-sos/commit/d85054395c9590321b36aaf8dadb90842692ffef)), closes [#600](https://github.com/ptarmiganlabs/butler-sos/issues/600)
* Make thirdPartyToolsCredentials section in config file optional ([c20927b](https://github.com/ptarmiganlabs/butler-sos/commit/c20927bf05dbdd30cacabdb77c033b0fe208f7e1)), closes [#600](https://github.com/ptarmiganlabs/butler-sos/issues/600)

## [9.6.1](https://github.com/ptarmiganlabs/butler-sos/compare/v9.6.0...v9.6.1) (2023-08-21)


### Bug Fixes

* Make InfluxDB debug msgs during startup more informative ([212fc72](https://github.com/ptarmiganlabs/butler-sos/commit/212fc721b6971407d60521c838b563ec55cf2cae)), closes [#596](https://github.com/ptarmiganlabs/butler-sos/issues/596)
* Make QS cert passphrase optional ([9e77d10](https://github.com/ptarmiganlabs/butler-sos/commit/9e77d1080da2e04ff498d629cc76d952a499f26d))
* Won't start when no config file specified on command line ([d1d0090](https://github.com/ptarmiganlabs/butler-sos/commit/d1d00902c6f6c5829024ccff2a55a399a5603970))

## [9.6.0](https://github.com/ptarmiganlabs/butler-sos/compare/v9.5.3...v9.6.0) (2023-08-21)


### Features

* **config:** Config file verification ([8e3e6f4](https://github.com/ptarmiganlabs/butler-sos/commit/8e3e6f4178e931effc882286eaf07055495fafe0)), closes [#585](https://github.com/ptarmiganlabs/butler-sos/issues/585)


### Miscellaneous

* **deps-dev:** Bump semver from 6.3.0 to 6.3.1 ([24b8d35](https://github.com/ptarmiganlabs/butler-sos/commit/24b8d35df52840caed2b7fed738c15675593085f))
* **deps:** Update dependencies to stay safe and secure ([9980039](https://github.com/ptarmiganlabs/butler-sos/commit/998003974fe96cc2743b7461f3c0202e4e064681))


### Refactoring

* More consistent source code structure ([d52a029](https://github.com/ptarmiganlabs/butler-sos/commit/d52a029fc4abe0f7b07832d5f46dae5d6a414368))

## [9.5.3](https://github.com/ptarmiganlabs/butler-sos/compare/v9.5.2...v9.5.3) (2023-08-18)


### Bug Fixes

* **deps:** update dependency pg to v8.11.3 ([51d2c9c](https://github.com/ptarmiganlabs/butler-sos/commit/51d2c9c812aa0db23de43a2a815bccc368b610e5))
* **deps:** update dependency posthog-node to v3.1.2 ([1a1817f](https://github.com/ptarmiganlabs/butler-sos/commit/1a1817f43f7595e1686dc0537a098d17fc97bece))
* **docker:** Fix broken Docker image ([16f57cd](https://github.com/ptarmiganlabs/butler-sos/commit/16f57cd960187f6b474cf389656ec484cd8cc1be))
* **telemetry:** Set telemetry reporting interval to 12 hours ([cb2f518](https://github.com/ptarmiganlabs/butler-sos/commit/cb2f518c1981f5737fda4cef914b9b595f438f6e)), closes [#581](https://github.com/ptarmiganlabs/butler-sos/issues/581)
* Update README.md ([d043446](https://github.com/ptarmiganlabs/butler-sos/commit/d043446de950aaa3ceb1f153ae3ef93044f88dea))


### Miscellaneous

* **deps:** update dependency snyk to v1.1203.0 ([835444d](https://github.com/ptarmiganlabs/butler-sos/commit/835444ddc5a283181f17a1daa8941f98a63b22a8))
* Fine tuning of build pipeline ([2d7ef9b](https://github.com/ptarmiganlabs/butler-sos/commit/2d7ef9bd018f4f5f8e5022e2afec0437121fb583))


### Documentation

* FIxing typos in readme file ([6d9920f](https://github.com/ptarmiganlabs/butler-sos/commit/6d9920f5ca7786181b7b249b8a61de9660004360))
* Update docs ([be1ef8d](https://github.com/ptarmiganlabs/butler-sos/commit/be1ef8d54649f4d1b054dad41d1d3f462e5cd21b))

## [9.5.2](https://github.com/ptarmiganlabs/butler-sos/compare/v9.5.1...v9.5.2) (2023-08-16)


### Bug Fixes

* **deps:** update dependency mqtt to v5.0.3 ([8bb01ca](https://github.com/ptarmiganlabs/butler-sos/commit/8bb01caae1395434143d1b3768678c9c94a9f201))
* Tweaking CI... ([67f7823](https://github.com/ptarmiganlabs/butler-sos/commit/67f7823c80aeb722506fd726a203a11374090b53))
* Update Dockerfile ([00cb3a5](https://github.com/ptarmiganlabs/butler-sos/commit/00cb3a571f81843a6b27fa7c0f90de38b33b681f))

## [9.5.1](https://github.com/ptarmiganlabs/butler-sos/compare/v9.5.0...v9.5.1) (2023-08-16)


### Bug Fixes

* Update ci.yaml ([4e9326d](https://github.com/ptarmiganlabs/butler-sos/commit/4e9326d0e65f5fbb22ee60019731590688bdfcf2))


### Refactoring

* Tweak CI ([989db19](https://github.com/ptarmiganlabs/butler-sos/commit/989db197240b1aaf83f8c0d5cf6b853cc729b441))

## [9.5.0](https://github.com/ptarmiganlabs/butler-sos/compare/v9.5.2...v9.5.0) (2023-08-16)


### Features

* Sign windows binaries ([9d2a311](https://github.com/ptarmiganlabs/butler-sos/commit/9d2a311fd697154d518d28692684cb52596c1a45))
* **telemetry:** Replace existing telemetry solution with PostHog ([0f60edc](https://github.com/ptarmiganlabs/butler-sos/commit/0f60edcdd421fd4956b8e26897ad75b4239fad26)), closes [#523](https://github.com/ptarmiganlabs/butler-sos/issues/523)


### Bug Fixes

* Build process broken ([5fb2a51](https://github.com/ptarmiganlabs/butler-sos/commit/5fb2a51c0c39eca775bb5e6f51b1c11fbeab4665))
* **build:** Disable Docker image build status via MQTT ([84c1bae](https://github.com/ptarmiganlabs/butler-sos/commit/84c1bae136a9fedca52b7cb21fe51ec4d56006f8))
* **build:** Fix broken Docker build ([eaa36d3](https://github.com/ptarmiganlabs/butler-sos/commit/eaa36d307b74be3bc787db5d5c93b5681a535044))
* **docs:** Status badges in README now show as intended ([5b154af](https://github.com/ptarmiganlabs/butler-sos/commit/5b154af26bf4c7a16a743c040565f0e450e84976))
* Fix broken Windows build pipeline ([72ab01f](https://github.com/ptarmiganlabs/butler-sos/commit/72ab01f356a3707c3ca018bc7714aa0931d3f5fe))
* Refine Docker image build ([2a07f8a](https://github.com/ptarmiganlabs/butler-sos/commit/2a07f8a259a8e1e936b841dc4a17182a10767f94))


### Miscellaneous

* **build:** Clean up build script ([5a42aad](https://github.com/ptarmiganlabs/butler-sos/commit/5a42aad08757b141c8c8cbb5a12eab4e019ce5e3))
* **deps:** Update dependencies to stay safe and secure ([cfee6f7](https://github.com/ptarmiganlabs/butler-sos/commit/cfee6f7e739f9ee495e4f70054e5b50dc7f48dcb))
* **deps:** Update dependencies to stay safe and secure ([3244a0d](https://github.com/ptarmiganlabs/butler-sos/commit/3244a0dabc07a5e27a27b62fd495448c56f992a4))
* **deps:** Update dependencies to stay safe and secure ([48efac0](https://github.com/ptarmiganlabs/butler-sos/commit/48efac0041dbccf604b325f5732c40df424b9172))
* **deps:** Update dependencies to stay safe and secure ([e7de02b](https://github.com/ptarmiganlabs/butler-sos/commit/e7de02b1d8244c1a62f1a60b8f45d39212bf493c))
* **deps:** Upgrade Docker build pipeline ([c6ad9c7](https://github.com/ptarmiganlabs/butler-sos/commit/c6ad9c7e80d28c524d934bf07e818fceebf1b1b0))
* Fix broken builds ([00cef7b](https://github.com/ptarmiganlabs/butler-sos/commit/00cef7b68547c1839db268fff76e370c191ceb89))
* **master:** release 9.3.2 ([6211b5a](https://github.com/ptarmiganlabs/butler-sos/commit/6211b5ab0404dd95649971a734d6ced6383ba9f1))
* **master:** release 9.3.3 ([6d920a5](https://github.com/ptarmiganlabs/butler-sos/commit/6d920a5c9a9b525c36029cfc686b3b550d4e37c2))
* **master:** release 9.4.0 ([084b336](https://github.com/ptarmiganlabs/butler-sos/commit/084b336da413466dfc1df0be53fbf7fd19e7561d))
* **master:** release 9.4.1 ([5888553](https://github.com/ptarmiganlabs/butler-sos/commit/58885533cf077b251d70c046f35b3090f0d85fca))
* **master:** release 9.5.2 ([fd99774](https://github.com/ptarmiganlabs/butler-sos/commit/fd99774c983be5b864f38c5ca3c1a602ff697e02))
* **master:** release butler-sos 9.5.0 ([76f3b18](https://github.com/ptarmiganlabs/butler-sos/commit/76f3b18d14bcac4b78fcfbf83bbb6921808b6128))
* **master:** release butler-sos 9.5.0 ([e3c5ed1](https://github.com/ptarmiganlabs/butler-sos/commit/e3c5ed147a1d62d45921b62e9dab78031c469fbf))
* **master:** release butler-sos 9.5.0 ([ab5c2ec](https://github.com/ptarmiganlabs/butler-sos/commit/ab5c2ec7b055f68428682b0cbe59abda9aacf050))
* **master:** release butler-sos 9.5.0 ([d5edb61](https://github.com/ptarmiganlabs/butler-sos/commit/d5edb61cec4afc1278847ba1054f5f9b96d6e588))
* **master:** release butler-sos 9.5.0 ([49bfff2](https://github.com/ptarmiganlabs/butler-sos/commit/49bfff29550a54eb74791e9f2d2dbe4862734c29))
* **master:** release butler-sos 9.5.1 ([ad2255c](https://github.com/ptarmiganlabs/butler-sos/commit/ad2255c9c24f68d0adb5255159fa5a849ab880e4))
* **master:** release butler-sos 9.5.2 ([9f235d9](https://github.com/ptarmiganlabs/butler-sos/commit/9f235d9f438f09879b80f50cd9a75769ed15311b))
* Sign Win binaries, upload binaries to antivirus scanner ([da537d8](https://github.com/ptarmiganlabs/butler-sos/commit/da537d8210024d0319b64555f3e39cdef02966a1))


### Refactoring

* Change structure of source code for better maintainability ([a4ebe4e](https://github.com/ptarmiganlabs/butler-sos/commit/a4ebe4e2cacac0c104895b514f691b7ce6ba98f1))


### Documentation

* Add status badge to README file ([11871c8](https://github.com/ptarmiganlabs/butler-sos/commit/11871c82aa828269ca17b3a36c692525453ecfa3))

## [9.5.2](https://github.com/ptarmiganlabs/butler-sos/compare/v9.5.2...v9.5.2) (2023-08-16)


### Bug Fixes

* **build:** Fix broken Docker build ([eaa36d3](https://github.com/ptarmiganlabs/butler-sos/commit/eaa36d307b74be3bc787db5d5c93b5681a535044))


### Miscellaneous

* **master:** release butler-sos 9.5.2 ([9f235d9](https://github.com/ptarmiganlabs/butler-sos/commit/9f235d9f438f09879b80f50cd9a75769ed15311b))


### Refactoring

* Change structure of source code for better maintainability ([a4ebe4e](https://github.com/ptarmiganlabs/butler-sos/commit/a4ebe4e2cacac0c104895b514f691b7ce6ba98f1))

## [9.5.2](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v9.5.1...butler-sos-v9.5.2) (2023-08-16)


### Bug Fixes

* **build:** Fix broken Docker build ([eaa36d3](https://github.com/ptarmiganlabs/butler-sos/commit/eaa36d307b74be3bc787db5d5c93b5681a535044))

## [9.5.1](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v9.5.0...butler-sos-v9.5.1) (2023-08-16)


### Bug Fixes

* **build:** Disable Docker image build status via MQTT ([84c1bae](https://github.com/ptarmiganlabs/butler-sos/commit/84c1bae136a9fedca52b7cb21fe51ec4d56006f8))
* **docs:** Status badges in README now show as intended ([5b154af](https://github.com/ptarmiganlabs/butler-sos/commit/5b154af26bf4c7a16a743c040565f0e450e84976))


### Miscellaneous

* **build:** Clean up build script ([5a42aad](https://github.com/ptarmiganlabs/butler-sos/commit/5a42aad08757b141c8c8cbb5a12eab4e019ce5e3))

## [9.5.0](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v9.5.0...butler-sos-v9.5.0) (2023-08-15)


### Features

* Sign windows binaries ([9d2a311](https://github.com/ptarmiganlabs/butler-sos/commit/9d2a311fd697154d518d28692684cb52596c1a45))
* **telemetry:** Replace existing telemetry solution with PostHog ([0f60edc](https://github.com/ptarmiganlabs/butler-sos/commit/0f60edcdd421fd4956b8e26897ad75b4239fad26)), closes [#523](https://github.com/ptarmiganlabs/butler-sos/issues/523)


### Bug Fixes

* Build process broken ([5fb2a51](https://github.com/ptarmiganlabs/butler-sos/commit/5fb2a51c0c39eca775bb5e6f51b1c11fbeab4665))
* Fix broken Windows build pipeline ([72ab01f](https://github.com/ptarmiganlabs/butler-sos/commit/72ab01f356a3707c3ca018bc7714aa0931d3f5fe))


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([cfee6f7](https://github.com/ptarmiganlabs/butler-sos/commit/cfee6f7e739f9ee495e4f70054e5b50dc7f48dcb))
* **deps:** Update dependencies to stay safe and secure ([3244a0d](https://github.com/ptarmiganlabs/butler-sos/commit/3244a0dabc07a5e27a27b62fd495448c56f992a4))
* **deps:** Update dependencies to stay safe and secure ([48efac0](https://github.com/ptarmiganlabs/butler-sos/commit/48efac0041dbccf604b325f5732c40df424b9172))
* **deps:** Update dependencies to stay safe and secure ([e7de02b](https://github.com/ptarmiganlabs/butler-sos/commit/e7de02b1d8244c1a62f1a60b8f45d39212bf493c))
* **deps:** Upgrade Docker build pipeline ([c6ad9c7](https://github.com/ptarmiganlabs/butler-sos/commit/c6ad9c7e80d28c524d934bf07e818fceebf1b1b0))
* Fix broken builds ([00cef7b](https://github.com/ptarmiganlabs/butler-sos/commit/00cef7b68547c1839db268fff76e370c191ceb89))
* **master:** release 9.3.2 ([6211b5a](https://github.com/ptarmiganlabs/butler-sos/commit/6211b5ab0404dd95649971a734d6ced6383ba9f1))
* **master:** release 9.3.3 ([6d920a5](https://github.com/ptarmiganlabs/butler-sos/commit/6d920a5c9a9b525c36029cfc686b3b550d4e37c2))
* **master:** release 9.4.0 ([084b336](https://github.com/ptarmiganlabs/butler-sos/commit/084b336da413466dfc1df0be53fbf7fd19e7561d))
* **master:** release 9.4.1 ([5888553](https://github.com/ptarmiganlabs/butler-sos/commit/58885533cf077b251d70c046f35b3090f0d85fca))
* **master:** release butler-sos 9.5.0 ([e3c5ed1](https://github.com/ptarmiganlabs/butler-sos/commit/e3c5ed147a1d62d45921b62e9dab78031c469fbf))
* **master:** release butler-sos 9.5.0 ([ab5c2ec](https://github.com/ptarmiganlabs/butler-sos/commit/ab5c2ec7b055f68428682b0cbe59abda9aacf050))
* **master:** release butler-sos 9.5.0 ([d5edb61](https://github.com/ptarmiganlabs/butler-sos/commit/d5edb61cec4afc1278847ba1054f5f9b96d6e588))
* **master:** release butler-sos 9.5.0 ([49bfff2](https://github.com/ptarmiganlabs/butler-sos/commit/49bfff29550a54eb74791e9f2d2dbe4862734c29))
* Sign Win binaries, upload binaries to antivirus scanner ([da537d8](https://github.com/ptarmiganlabs/butler-sos/commit/da537d8210024d0319b64555f3e39cdef02966a1))


### Documentation

* Add status badge to README file ([11871c8](https://github.com/ptarmiganlabs/butler-sos/commit/11871c82aa828269ca17b3a36c692525453ecfa3))

## [9.5.0](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v9.5.0...butler-sos-v9.5.0) (2023-08-15)


### Features

* Sign windows binaries ([9d2a311](https://github.com/ptarmiganlabs/butler-sos/commit/9d2a311fd697154d518d28692684cb52596c1a45))
* **telemetry:** Replace existing telemetry solution with PostHog ([0f60edc](https://github.com/ptarmiganlabs/butler-sos/commit/0f60edcdd421fd4956b8e26897ad75b4239fad26)), closes [#523](https://github.com/ptarmiganlabs/butler-sos/issues/523)


### Bug Fixes

* Build process broken ([5fb2a51](https://github.com/ptarmiganlabs/butler-sos/commit/5fb2a51c0c39eca775bb5e6f51b1c11fbeab4665))
* Fix broken Windows build pipeline ([72ab01f](https://github.com/ptarmiganlabs/butler-sos/commit/72ab01f356a3707c3ca018bc7714aa0931d3f5fe))


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([48efac0](https://github.com/ptarmiganlabs/butler-sos/commit/48efac0041dbccf604b325f5732c40df424b9172))
* **deps:** Update dependencies to stay safe and secure ([e7de02b](https://github.com/ptarmiganlabs/butler-sos/commit/e7de02b1d8244c1a62f1a60b8f45d39212bf493c))
* **deps:** Upgrade Docker build pipeline ([c6ad9c7](https://github.com/ptarmiganlabs/butler-sos/commit/c6ad9c7e80d28c524d934bf07e818fceebf1b1b0))
* Fix broken builds ([00cef7b](https://github.com/ptarmiganlabs/butler-sos/commit/00cef7b68547c1839db268fff76e370c191ceb89))
* **master:** release 9.3.2 ([6211b5a](https://github.com/ptarmiganlabs/butler-sos/commit/6211b5ab0404dd95649971a734d6ced6383ba9f1))
* **master:** release 9.3.3 ([6d920a5](https://github.com/ptarmiganlabs/butler-sos/commit/6d920a5c9a9b525c36029cfc686b3b550d4e37c2))
* **master:** release 9.4.0 ([084b336](https://github.com/ptarmiganlabs/butler-sos/commit/084b336da413466dfc1df0be53fbf7fd19e7561d))
* **master:** release 9.4.1 ([5888553](https://github.com/ptarmiganlabs/butler-sos/commit/58885533cf077b251d70c046f35b3090f0d85fca))
* **master:** release butler-sos 9.5.0 ([ab5c2ec](https://github.com/ptarmiganlabs/butler-sos/commit/ab5c2ec7b055f68428682b0cbe59abda9aacf050))
* **master:** release butler-sos 9.5.0 ([d5edb61](https://github.com/ptarmiganlabs/butler-sos/commit/d5edb61cec4afc1278847ba1054f5f9b96d6e588))
* **master:** release butler-sos 9.5.0 ([49bfff2](https://github.com/ptarmiganlabs/butler-sos/commit/49bfff29550a54eb74791e9f2d2dbe4862734c29))
* Sign Win binaries, upload binaries to antivirus scanner ([da537d8](https://github.com/ptarmiganlabs/butler-sos/commit/da537d8210024d0319b64555f3e39cdef02966a1))


### Documentation

* Add status badge to README file ([11871c8](https://github.com/ptarmiganlabs/butler-sos/commit/11871c82aa828269ca17b3a36c692525453ecfa3))

## [9.5.0](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v9.5.0...butler-sos-v9.5.0) (2023-08-15)


### Features

* Sign windows binaries ([9d2a311](https://github.com/ptarmiganlabs/butler-sos/commit/9d2a311fd697154d518d28692684cb52596c1a45))
* **telemetry:** Replace existing telemetry solution with PostHog ([0f60edc](https://github.com/ptarmiganlabs/butler-sos/commit/0f60edcdd421fd4956b8e26897ad75b4239fad26)), closes [#523](https://github.com/ptarmiganlabs/butler-sos/issues/523)


### Bug Fixes

* Build process broken ([5fb2a51](https://github.com/ptarmiganlabs/butler-sos/commit/5fb2a51c0c39eca775bb5e6f51b1c11fbeab4665))
* Fix broken Windows build pipeline ([72ab01f](https://github.com/ptarmiganlabs/butler-sos/commit/72ab01f356a3707c3ca018bc7714aa0931d3f5fe))


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([48efac0](https://github.com/ptarmiganlabs/butler-sos/commit/48efac0041dbccf604b325f5732c40df424b9172))
* **deps:** Update dependencies to stay safe and secure ([e7de02b](https://github.com/ptarmiganlabs/butler-sos/commit/e7de02b1d8244c1a62f1a60b8f45d39212bf493c))
* **deps:** Upgrade Docker build pipeline ([c6ad9c7](https://github.com/ptarmiganlabs/butler-sos/commit/c6ad9c7e80d28c524d934bf07e818fceebf1b1b0))
* Fix broken builds ([00cef7b](https://github.com/ptarmiganlabs/butler-sos/commit/00cef7b68547c1839db268fff76e370c191ceb89))
* **master:** release 9.3.2 ([6211b5a](https://github.com/ptarmiganlabs/butler-sos/commit/6211b5ab0404dd95649971a734d6ced6383ba9f1))
* **master:** release 9.3.3 ([6d920a5](https://github.com/ptarmiganlabs/butler-sos/commit/6d920a5c9a9b525c36029cfc686b3b550d4e37c2))
* **master:** release 9.4.0 ([084b336](https://github.com/ptarmiganlabs/butler-sos/commit/084b336da413466dfc1df0be53fbf7fd19e7561d))
* **master:** release 9.4.1 ([5888553](https://github.com/ptarmiganlabs/butler-sos/commit/58885533cf077b251d70c046f35b3090f0d85fca))
* **master:** release butler-sos 9.5.0 ([d5edb61](https://github.com/ptarmiganlabs/butler-sos/commit/d5edb61cec4afc1278847ba1054f5f9b96d6e588))
* **master:** release butler-sos 9.5.0 ([49bfff2](https://github.com/ptarmiganlabs/butler-sos/commit/49bfff29550a54eb74791e9f2d2dbe4862734c29))
* Sign Win binaries, upload binaries to antivirus scanner ([da537d8](https://github.com/ptarmiganlabs/butler-sos/commit/da537d8210024d0319b64555f3e39cdef02966a1))


### Documentation

* Add status badge to README file ([11871c8](https://github.com/ptarmiganlabs/butler-sos/commit/11871c82aa828269ca17b3a36c692525453ecfa3))

## [9.5.0](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v9.5.0...butler-sos-v9.5.0) (2023-07-30)


### Features

* Sign windows binaries ([9d2a311](https://github.com/ptarmiganlabs/butler-sos/commit/9d2a311fd697154d518d28692684cb52596c1a45))
* **telemetry:** Replace existing telemetry solution with PostHog ([0f60edc](https://github.com/ptarmiganlabs/butler-sos/commit/0f60edcdd421fd4956b8e26897ad75b4239fad26)), closes [#523](https://github.com/ptarmiganlabs/butler-sos/issues/523)


### Bug Fixes

* Build process broken ([5fb2a51](https://github.com/ptarmiganlabs/butler-sos/commit/5fb2a51c0c39eca775bb5e6f51b1c11fbeab4665))
* Fix broken Windows build pipeline ([72ab01f](https://github.com/ptarmiganlabs/butler-sos/commit/72ab01f356a3707c3ca018bc7714aa0931d3f5fe))


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([48efac0](https://github.com/ptarmiganlabs/butler-sos/commit/48efac0041dbccf604b325f5732c40df424b9172))
* **deps:** Update dependencies to stay safe and secure ([e7de02b](https://github.com/ptarmiganlabs/butler-sos/commit/e7de02b1d8244c1a62f1a60b8f45d39212bf493c))
* **deps:** Upgrade Docker build pipeline ([c6ad9c7](https://github.com/ptarmiganlabs/butler-sos/commit/c6ad9c7e80d28c524d934bf07e818fceebf1b1b0))
* Fix broken builds ([00cef7b](https://github.com/ptarmiganlabs/butler-sos/commit/00cef7b68547c1839db268fff76e370c191ceb89))
* **master:** release 9.3.2 ([6211b5a](https://github.com/ptarmiganlabs/butler-sos/commit/6211b5ab0404dd95649971a734d6ced6383ba9f1))
* **master:** release 9.3.3 ([6d920a5](https://github.com/ptarmiganlabs/butler-sos/commit/6d920a5c9a9b525c36029cfc686b3b550d4e37c2))
* **master:** release 9.4.0 ([084b336](https://github.com/ptarmiganlabs/butler-sos/commit/084b336da413466dfc1df0be53fbf7fd19e7561d))
* **master:** release 9.4.1 ([5888553](https://github.com/ptarmiganlabs/butler-sos/commit/58885533cf077b251d70c046f35b3090f0d85fca))
* **master:** release butler-sos 9.5.0 ([49bfff2](https://github.com/ptarmiganlabs/butler-sos/commit/49bfff29550a54eb74791e9f2d2dbe4862734c29))
* Sign Win binaries, upload binaries to antivirus scanner ([da537d8](https://github.com/ptarmiganlabs/butler-sos/commit/da537d8210024d0319b64555f3e39cdef02966a1))


### Documentation

* Add status badge to README file ([11871c8](https://github.com/ptarmiganlabs/butler-sos/commit/11871c82aa828269ca17b3a36c692525453ecfa3))

## [9.5.0](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v9.5.0...butler-sos-v9.5.0) (2023-07-30)


### Features

* Sign windows binaries ([9d2a311](https://github.com/ptarmiganlabs/butler-sos/commit/9d2a311fd697154d518d28692684cb52596c1a45))
* **telemetry:** Replace existing telemetry solution with PostHog ([0f60edc](https://github.com/ptarmiganlabs/butler-sos/commit/0f60edcdd421fd4956b8e26897ad75b4239fad26)), closes [#523](https://github.com/ptarmiganlabs/butler-sos/issues/523)


### Bug Fixes

* Build process broken ([5fb2a51](https://github.com/ptarmiganlabs/butler-sos/commit/5fb2a51c0c39eca775bb5e6f51b1c11fbeab4665))
* Fix broken Windows build pipeline ([72ab01f](https://github.com/ptarmiganlabs/butler-sos/commit/72ab01f356a3707c3ca018bc7714aa0931d3f5fe))


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([48efac0](https://github.com/ptarmiganlabs/butler-sos/commit/48efac0041dbccf604b325f5732c40df424b9172))
* **deps:** Update dependencies to stay safe and secure ([e7de02b](https://github.com/ptarmiganlabs/butler-sos/commit/e7de02b1d8244c1a62f1a60b8f45d39212bf493c))
* **deps:** Upgrade Docker build pipeline ([c6ad9c7](https://github.com/ptarmiganlabs/butler-sos/commit/c6ad9c7e80d28c524d934bf07e818fceebf1b1b0))
* Fix broken builds ([00cef7b](https://github.com/ptarmiganlabs/butler-sos/commit/00cef7b68547c1839db268fff76e370c191ceb89))
* **master:** release 9.3.2 ([6211b5a](https://github.com/ptarmiganlabs/butler-sos/commit/6211b5ab0404dd95649971a734d6ced6383ba9f1))
* **master:** release 9.3.3 ([6d920a5](https://github.com/ptarmiganlabs/butler-sos/commit/6d920a5c9a9b525c36029cfc686b3b550d4e37c2))
* **master:** release 9.4.0 ([084b336](https://github.com/ptarmiganlabs/butler-sos/commit/084b336da413466dfc1df0be53fbf7fd19e7561d))
* **master:** release 9.4.1 ([5888553](https://github.com/ptarmiganlabs/butler-sos/commit/58885533cf077b251d70c046f35b3090f0d85fca))
* Sign Win binaries, upload binaries to antivirus scanner ([da537d8](https://github.com/ptarmiganlabs/butler-sos/commit/da537d8210024d0319b64555f3e39cdef02966a1))


### Documentation

* Add status badge to README file ([11871c8](https://github.com/ptarmiganlabs/butler-sos/commit/11871c82aa828269ca17b3a36c692525453ecfa3))

## [9.4.1](https://github.com/ptarmiganlabs/butler-sos/compare/v9.4.0...v9.4.1) (2023-03-30)


### Bug Fixes

* Fix broken Windows build pipeline ([72ab01f](https://github.com/ptarmiganlabs/butler-sos/commit/72ab01f356a3707c3ca018bc7714aa0931d3f5fe))


### Miscellaneous

* **deps:** Upgrade Docker build pipeline ([c6ad9c7](https://github.com/ptarmiganlabs/butler-sos/commit/c6ad9c7e80d28c524d934bf07e818fceebf1b1b0))

## [9.4.0](https://github.com/ptarmiganlabs/butler-sos/compare/v9.3.3...v9.4.0) (2023-03-30)


### Features

* Sign windows binaries ([9d2a311](https://github.com/ptarmiganlabs/butler-sos/commit/9d2a311fd697154d518d28692684cb52596c1a45))

## [9.3.3](https://github.com/ptarmiganlabs/butler-sos/compare/v9.3.2...v9.3.3) (2023-03-30)


### Bug Fixes

* Build process broken ([5fb2a51](https://github.com/ptarmiganlabs/butler-sos/commit/5fb2a51c0c39eca775bb5e6f51b1c11fbeab4665))

## [9.3.2](https://github.com/ptarmiganlabs/butler-sos/compare/v9.3.1...v9.3.2) (2023-03-29)


### Documentation

* Add status badge to README file ([11871c8](https://github.com/ptarmiganlabs/butler-sos/commit/11871c82aa828269ca17b3a36c692525453ecfa3))


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([e7de02b](https://github.com/ptarmiganlabs/butler-sos/commit/e7de02b1d8244c1a62f1a60b8f45d39212bf493c))

## [9.3.1](https://github.com/ptarmiganlabs/butler-sos/compare/v9.3.0...v9.3.1) (2023-01-11)


### Miscellaneous

* **deps:** Update dependencies to stay safe & secure ([bf91c4f](https://github.com/ptarmiganlabs/butler-sos/commit/bf91c4f05a45d1d4e5422576aee082381453c649))
* **deps:** update node.js to v19 ([ba72504](https://github.com/ptarmiganlabs/butler-sos/commit/ba72504eb2ab1a6e6e3f613ce94b2c07f7eb8d97))
* **security:** Add automatic scans for updated dependencies ([e61e28e](https://github.com/ptarmiganlabs/butler-sos/commit/e61e28ee7696743af0e05a67a2d8d10bd92f43da))


### Documentation

* Clean up Markdown ([cd79b3c](https://github.com/ptarmiganlabs/butler-sos/commit/cd79b3c9aae394e787ceb224b15478c3e8198c25))

## [9.3.0](https://github.com/ptarmiganlabs/butler-sos/compare/v9.2.2...v9.3.0) (2023-01-04)


### Features

* Add virus/malware scanning of standalone binaries during build ([2aaf091](https://github.com/ptarmiganlabs/butler-sos/commit/2aaf0919b62e724b2063e17572ac2ba84364c4a7)), closes [#449](https://github.com/ptarmiganlabs/butler-sos/issues/449)


### Miscellaneous

* **deps:** Update dependencies to stay safe & secure ([600b22d](https://github.com/ptarmiganlabs/butler-sos/commit/600b22d745b1df46a47a480708ecbb1b7f393213))
* **deps:** Update dependencies to stay safe & secure ([2142590](https://github.com/ptarmiganlabs/butler-sos/commit/2142590e34ab672ed04cb9d4307c342214deef58))

## [9.2.2](https://github.com/ptarmiganlabs/butler-sos/compare/v9.2.1...v9.2.2) (2022-10-13)


### Miscellaneous

* **deps:** bump fastify from 4.5.3 to 4.8.1 ([42d6f52](https://github.com/ptarmiganlabs/butler-sos/commit/42d6f52024f5aa10239348fd94dd9750a4b2aaaf))

## [9.2.1](https://github.com/ptarmiganlabs/butler-sos/compare/v9.2.0...v9.2.1) (2022-08-27)


### Bug Fixes

* Incorrect comments in sample docker-compose files ([326cf58](https://github.com/ptarmiganlabs/butler-sos/commit/326cf5846fde12f5f149be96dc66b284a8dc2422)), closes [#439](https://github.com/ptarmiganlabs/butler-sos/issues/439)
* Unmatched server tags in sample YAML config file ([5a9d3b6](https://github.com/ptarmiganlabs/butler-sos/commit/5a9d3b67010202b58effbc22da6a17924a6e7ee0)), closes [#438](https://github.com/ptarmiganlabs/butler-sos/issues/438)


### Documentation

* Add Grafana 9 dashboard for Butler SOS 9.2 ([4c21567](https://github.com/ptarmiganlabs/butler-sos/commit/4c2156782b6130c4f03fe4f262f1c80540292744)), closes [#440](https://github.com/ptarmiganlabs/butler-sos/issues/440)

## [9.2.0](https://github.com/ptarmiganlabs/butler-sos/compare/v9.1.0...v9.2.0) (2022-08-08)


### Features

* Add support for storing Sense engine warning/error log messages in InfluxDB. ([40d784f](https://github.com/ptarmiganlabs/butler-sos/commit/40d784f037c5db57ab9ad4c5931303ae61bf914b)), closes [#435](https://github.com/ptarmiganlabs/butler-sos/issues/435)
* Make it possible to specify one or more New Relic account credentials via command line ([66cda6d](https://github.com/ptarmiganlabs/butler-sos/commit/66cda6d0ab9b9a5d1dd853ec7b8008115ad0f8b5)), closes [#429](https://github.com/ptarmiganlabs/butler-sos/issues/429)
* Specify zero or more New Relic credentials via command line option ([fccea2a](https://github.com/ptarmiganlabs/butler-sos/commit/fccea2a053e644596073af49a510e93952760e30)), closes [#429](https://github.com/ptarmiganlabs/butler-sos/issues/429)
* support for sending metrics and events to multiple New Relic accounts ([a872181](https://github.com/ptarmiganlabs/butler-sos/commit/a8721816dffac938ccc3b9783a1fec1e17d7cdeb)), closes [#417](https://github.com/ptarmiganlabs/butler-sos/issues/417)
* Write info on startup about execution type ([4e99e5f](https://github.com/ptarmiganlabs/butler-sos/commit/4e99e5f34379914c0f138f828ddeab1c5f84c5a5)), closes [#430](https://github.com/ptarmiganlabs/butler-sos/issues/430)


### Bug Fixes

* Add missing XML log appender file for QS engine service ([6b0f79a](https://github.com/ptarmiganlabs/butler-sos/commit/6b0f79a1a224e79c38fe24ca9b5c3c0132648999)), closes [#433](https://github.com/ptarmiganlabs/butler-sos/issues/433)
* Log events now correctly sent to New Relic, incl engine log events. ([54123fb](https://github.com/ptarmiganlabs/butler-sos/commit/54123fb280ac167eddfbd19e1f60cea5882eeb51)), closes [#432](https://github.com/ptarmiganlabs/butler-sos/issues/432)


### Refactoring

* Remove unnecessary handling of engine performance log messages ([f05d501](https://github.com/ptarmiganlabs/butler-sos/commit/f05d5017aa48e1950829ccf1a961379512250199)), closes [#434](https://github.com/ptarmiganlabs/butler-sos/issues/434)


### Miscellaneous

* **deps:** Updated dependencies ([7836739](https://github.com/ptarmiganlabs/butler-sos/commit/7836739c27eb2fe95e51c87232674ebceba6e907))

## [9.1.0](https://github.com/ptarmiganlabs/butler-sos/compare/v9.0.2...v9.1.0) (2022-07-27)


### Features

* Better logging when warnings and errors occur ([f8abc64](https://github.com/ptarmiganlabs/butler-sos/commit/f8abc6427c09c99882c02b259ee1b8a831cfe332)), closes [#404](https://github.com/ptarmiganlabs/butler-sos/issues/404)


### Bug Fixes

* Send correct tags to Prometheus endpoint ([04f735e](https://github.com/ptarmiganlabs/butler-sos/commit/04f735e65aca1dd02b5aa176e78052f7f38df9e9)), closes [#422](https://github.com/ptarmiganlabs/butler-sos/issues/422)


### Refactoring

* Apply consistent formatting to all source and doc files ([2f1634e](https://github.com/ptarmiganlabs/butler-sos/commit/2f1634ebc5bd9e3aec509a680f2a033726062e75)), closes [#419](https://github.com/ptarmiganlabs/butler-sos/issues/419)
* Upgrade Prometheus metrics lib to latest version ([61d363a](https://github.com/ptarmiganlabs/butler-sos/commit/61d363a80e23dd68c984a3a4eef4a82fb9a110e6))


### Miscellaneous

* Update dependencies ([caa2f5c](https://github.com/ptarmiganlabs/butler-sos/commit/caa2f5c95af30d83dc918faf72fbfba3c36a04bb))
* update minor dependencies ([b89d155](https://github.com/ptarmiganlabs/butler-sos/commit/b89d155abf7bac4ddca06278317a3df6a97dc86f))
* upgrade to Fastify 4.x ([496f4ec](https://github.com/ptarmiganlabs/butler-sos/commit/496f4ec88c986d42eff344f5be9e2b65f5f6fe4a))

### [9.0.2](https://github.com/ptarmiganlabs/butler-sos/compare/v9.0.1...v9.0.2) (2022-05-23)


### Bug Fixes

* Properly show warnings when trying to send log events to New Relic ([8739c48](https://github.com/ptarmiganlabs/butler-sos/commit/8739c48eefb987de7d4e58d72bb9c50b6d6cfb57)), closes [#411](https://github.com/ptarmiganlabs/butler-sos/issues/411)

### [9.0.1](https://github.com/ptarmiganlabs/butler-sos/compare/v9.0.0...v9.0.1) (2022-05-16)


### Bug Fixes

* **docs:** Add missing New Relic entries to sample config file ([9a70111](https://github.com/ptarmiganlabs/butler-sos/commit/9a701111ab5086e271cd3e735b19c94613669eb7)), closes [#407](https://github.com/ptarmiganlabs/butler-sos/issues/407)

## [9.0.0](https://github.com/ptarmiganlabs/butler-sos/compare/v8.1.2...v9.0.0) (2022-05-16)


### ⚠ BREAKING CHANGES

* Add external memory to uptime data in InfluxDB

### Features

* Add command line options to Butler SOS ([e1d6577](https://github.com/ptarmiganlabs/butler-sos/commit/e1d65778878b2d16db3b099e5a83f53659201f01)), closes [#387](https://github.com/ptarmiganlabs/butler-sos/issues/387)
* Add external memory to uptime data in InfluxDB ([45447aa](https://github.com/ptarmiganlabs/butler-sos/commit/45447aae8b2b173d7725583191e9fd018f5c4767))
* Add New Relic as destination for SenseOps metrics ([394945a](https://github.com/ptarmiganlabs/butler-sos/commit/394945af429fc80bec0ae40071a45b0f59647963))
* Add optional scrambling of user id for user events sent to New Relic ([33364f5](https://github.com/ptarmiganlabs/butler-sos/commit/33364f591ec5674ed85c90cb46407d183a1ab0fc)), closes [#398](https://github.com/ptarmiganlabs/butler-sos/issues/398)
* Send engine, proxy and session metrics to New Relic. ([0b52eb5](https://github.com/ptarmiganlabs/butler-sos/commit/0b52eb5cb222f03f7a4b18eeafdb9f700758b7ee))


### Bug Fixes

* Compress stand-alone binaries ([028c9ab](https://github.com/ptarmiganlabs/butler-sos/commit/028c9ab23695e22f4f44f09ee4a1e89b10c52efa))
* **deps:** update dependency axios to ^0.27.0 ([efce7c8](https://github.com/ptarmiganlabs/butler-sos/commit/efce7c82896c8d27d68fb3fe75b5f66ad86b3e5a))
* Include New Relic status in telemtry data ([23c292c](https://github.com/ptarmiganlabs/butler-sos/commit/23c292cae4fd0dd18fec100641952a21c425ad3f))


### Refactoring

* Make proxy related log entries easier to understand ([fafe419](https://github.com/ptarmiganlabs/butler-sos/commit/fafe41980a806dbd8bffcde3d82db1436e3322b9)), closes [#392](https://github.com/ptarmiganlabs/butler-sos/issues/392)
* Make user event log messages easier to understand ([3740a2c](https://github.com/ptarmiganlabs/butler-sos/commit/3740a2ceaf8afb7aa8ce1ffcc73d5952725dbfd7)), closes [#396](https://github.com/ptarmiganlabs/butler-sos/issues/396)
* More relvant log prefixes for proxy session logging ([76ab969](https://github.com/ptarmiganlabs/butler-sos/commit/76ab969d1f8b0c1dd2a1e435f61296121ec8e7ef)), closes [#392](https://github.com/ptarmiganlabs/butler-sos/issues/392)


### Miscellaneous

* **deps:** update docker/build-push-action action to v3 ([c04b422](https://github.com/ptarmiganlabs/butler-sos/commit/c04b4226e9ce0c8dde904ceb986bccf66c6a4aac))
* **deps:** update docker/login-action action to v2 ([907c6bf](https://github.com/ptarmiganlabs/butler-sos/commit/907c6bf485b3daa4b6191880f623c958a567c7e8))
* **deps:** update docker/metadata-action action to v4 ([99f1fbf](https://github.com/ptarmiganlabs/butler-sos/commit/99f1fbffc9fdad3129ab3096c1dd9f3a3ac38b8f))
* **deps:** update docker/setup-buildx-action action to v2 ([c488648](https://github.com/ptarmiganlabs/butler-sos/commit/c488648b7e929849a7bb0f64cee144efd8dce8d6))
* **deps:** update docker/setup-qemu-action action to v2 ([b1352a2](https://github.com/ptarmiganlabs/butler-sos/commit/b1352a274ea334acb4ca73293ccb2c40bc209dac))
* **deps:** update github/codeql-action action to v2 ([f01bfad](https://github.com/ptarmiganlabs/butler-sos/commit/f01bfadd210f90ba0f7c062d41f6f41e7fff4508))
* **deps:** update node.js to v18 ([9276b68](https://github.com/ptarmiganlabs/butler-sos/commit/9276b68a8a756661c98d872bc5432d202ac091c9))

### [8.1.2](https://github.com/ptarmiganlabs/butler-sos/compare/v8.1.1...v8.1.2) (2022-04-09)


### Bug Fixes

* **deps:** update dependency eslint-config-prettier to v8.5.0 ([3331840](https://github.com/ptarmiganlabs/butler-sos/commit/3331840476da16287b891c0f142d38e65b0aebaf))
* **deps:** update dependency url-join to v5 ([ecc997f](https://github.com/ptarmiganlabs/butler-sos/commit/ecc997f3fb082bb7f8209d97a71ed6d47363a739))


### Miscellaneous

* **deps:** bump moment from 2.29.1 to 2.29.2 ([120888d](https://github.com/ptarmiganlabs/butler-sos/commit/120888dc58812647f6d94d90945c2bb6599e58f1))
* **deps:** update actions/checkout action to v3 ([4acf81c](https://github.com/ptarmiganlabs/butler-sos/commit/4acf81ce8ec8209992a75806857dec902dc8eae8))
* **deps:** update actions/download-artifact action to v3 ([c8ea704](https://github.com/ptarmiganlabs/butler-sos/commit/c8ea7042c20be155695b03c321ef3ffa9a776b11))
* **deps:** update actions/upload-artifact action to v3 ([776c4e9](https://github.com/ptarmiganlabs/butler-sos/commit/776c4e987aad46a579d10a1930859e4565ad3473))
* **deps:** update dependency prettier to v2.6.2 ([04456f7](https://github.com/ptarmiganlabs/butler-sos/commit/04456f752f11709ca67a755b99a00e60ad43b248))

### [8.1.1](https://github.com/ptarmiganlabs/butler-sos/compare/v8.1.0...v8.1.1) (2022-02-19)


### Bug Fixes

* Incorrect parsing of git tags > Incorrect Docker tags ([728c16a](https://github.com/ptarmiganlabs/butler-sos/commit/728c16a5f9cbdae8d36686fc8c75a8aea97f49f7))

## [8.1.0](https://github.com/ptarmiganlabs/butler-sos/compare/v8.0.0...v8.1.0) (2022-02-19)


### Features

* Scan for vulnerabilities as part of each release ([9d0d18d](https://github.com/ptarmiganlabs/butler-sos/commit/9d0d18df77e7ddc989cb0b1752f7d8c5b8119cd9)), closes [#361](https://github.com/ptarmiganlabs/butler-sos/issues/361)


### Bug Fixes

* Clean up Docker images ([d818060](https://github.com/ptarmiganlabs/butler-sos/commit/d81806038e00e4eeb6837d255918ea545f979102)), closes [#363](https://github.com/ptarmiganlabs/butler-sos/issues/363)
* Move docker-compose demo files to docs folder ([9f7a063](https://github.com/ptarmiganlabs/butler-sos/commit/9f7a0635b66412cbaa18e151ff6371cc1a64692e)), closes [#362](https://github.com/ptarmiganlabs/butler-sos/issues/362)

## [8.0.0](https://github.com/ptarmiganlabs/butler-sos/compare/v7.1.11...v8.0.0) (2022-02-19)


### ⚠ BREAKING CHANGES

* Restructure repository to get better working CI

### Bug Fixes

* CI debugging ([783a59b](https://github.com/ptarmiganlabs/butler-sos/commit/783a59b38f3542fb8352eb01ceece1a4fb0e90a4))
* Restructure repository to get better working CI ([dec58ce](https://github.com/ptarmiganlabs/butler-sos/commit/dec58ce7943f73957c8159573246a9fef5ddaf26)), closes [#357](https://github.com/ptarmiganlabs/butler-sos/issues/357)

### [7.1.9](https://github.com/ptarmiganlabs/butler-sos/compare/v7.1.8...v7.1.9) (2022-02-19)


### Bug Fixes

* App signing for macOS ([3585a70](https://github.com/ptarmiganlabs/butler-sos/commit/3585a701b8296892bee4862338179136a2526293))

### [7.1.8](https://github.com/ptarmiganlabs/butler-sos/compare/v7.1.7...v7.1.8) (2022-02-19)


### Bug Fixes

* Debug standalone executables ([298b076](https://github.com/ptarmiganlabs/butler-sos/commit/298b0767810b7ccdd80efaf99c5ef1ffec8fcb5a))

### [7.1.7](https://github.com/ptarmiganlabs/butler-sos/compare/v7.1.6...v7.1.7) (2022-02-19)


### Bug Fixes

* macOS app signing ([74c7559](https://github.com/ptarmiganlabs/butler-sos/commit/74c75591d347e5ab5b647c73ddec34480df0ab4b))

### [7.1.6](https://github.com/ptarmiganlabs/butler-sos/compare/v7.1.5...v7.1.6) (2022-02-19)


### Bug Fixes

* Fix macOS app signing ([94bd512](https://github.com/ptarmiganlabs/butler-sos/commit/94bd5121d80dbe03056c1c2fa4de8aaf3577fcb8))

### [7.1.5](https://github.com/ptarmiganlabs/butler-sos/compare/v7.1.4...v7.1.5) (2022-02-19)


### Bug Fixes

* Broken CI for macOS executable ([2b96667](https://github.com/ptarmiganlabs/butler-sos/commit/2b96667a6121e41e4c9b672a64b8e4487b5bf1c1))

### [7.1.4](https://github.com/ptarmiganlabs/butler-sos/compare/v7.1.3...v7.1.4) (2022-02-19)


### Bug Fixes

* Broken CI for macOS executable ([be80745](https://github.com/ptarmiganlabs/butler-sos/commit/be80745a8b1f0b4c4727860f573348630ffeb1ae))

### [7.1.3](https://github.com/ptarmiganlabs/butler-sos/compare/v7.1.2...v7.1.3) (2022-02-19)


### Bug Fixes

* CI tweaking ([49f2268](https://github.com/ptarmiganlabs/butler-sos/commit/49f22680171451484b5f1282c76c92f0ef6569e3))

### [7.1.2](https://github.com/ptarmiganlabs/butler-sos/compare/v7.1.1...v7.1.2) (2022-02-19)


### Bug Fixes

* CI tweaking ([3e0d357](https://github.com/ptarmiganlabs/butler-sos/commit/3e0d357f0456d2ee5dfdc42ae87f6e6dce86c677))
* CI tweaking ([56d25de](https://github.com/ptarmiganlabs/butler-sos/commit/56d25de0ef4cdf0c4ac6417e5083e88c50f97e6b))

### [7.1.1](https://github.com/ptarmiganlabs/butler-sos/compare/v7.1.0...v7.1.1) (2022-02-19)


### Documentation

* CI tweaking ([9107993](https://github.com/ptarmiganlabs/butler-sos/commit/9107993c912a8fdbc6cf6f06900f0cff8a168d6e))
