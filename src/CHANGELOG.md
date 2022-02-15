# Changelog

### [7.0.7](https://github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v7.0.6...butler-sos-v7.0.7) (2022-02-15)


### Bug Fixes

* **deps:** update dependency axios to ^0.26.0 ([6a8fafc](https://github.com/ptarmiganlabs/butler-sos/commit/6a8fafc88eafd3c620a4981482cc86785fa3d62b))


### Miscellaneous

* **deps:** update dependency snyk to v1.840.0 ([7a89d65](https://github.com/ptarmiganlabs/butler-sos/commit/7a89d657c9ead49a76bf632900308e26a8abbc4c))
* **deps:** update dependency snyk to v1.852.0 ([6bc5ba7](https://github.com/ptarmiganlabs/butler-sos/commit/6bc5ba7f9ffdb0a7e134073bcec07ef56926b2bb))

### [7.0.6](https://www.github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v7.0.5...butler-sos-v7.0.6) (2022-01-25)


### Bug Fixes

* Make get app names logging verbose, not info ([146bd24](https://www.github.com/ptarmiganlabs/butler-sos/commit/146bd243bd637401f3108f703968af4a98a78523)), closes [#297](https://www.github.com/ptarmiganlabs/butler-sos/issues/297)


### Miscellaneous

* **deps:** update dependency snyk to v1.833.0 ([#64](https://www.github.com/ptarmiganlabs/butler-sos/issues/64)) ([b800b85](https://www.github.com/ptarmiganlabs/butler-sos/commit/b800b852b524fc5c9ae1a1d748ebed814724815a))
* Update dependencies ([e71db48](https://www.github.com/ptarmiganlabs/butler-sos/commit/e71db488852badf11b0c96e5e1566738f8187536))

### [7.0.5](https://www.github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v7.0.4...butler-sos-v7.0.5) (2022-01-13)


### Bug Fixes

* Improve logs when getting app names ([20eb302](https://www.github.com/ptarmiganlabs/butler-sos/commit/20eb30211fecd8263421ca1b0783484a2f120e7c))


### Miscellaneous

* **deps:** update dependency snyk to v1.788.0 ([c4cfe15](https://www.github.com/ptarmiganlabs/butler-sos/commit/c4cfe158fcf5b27e99efd1a2a09bf7b97409af17))
* Update dependencies ([141d288](https://www.github.com/ptarmiganlabs/butler-sos/commit/141d288364657e5af40c69c75f2d5a7268e0cae8))

### [7.0.4](https://www.github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v7.0.3...butler-sos-v7.0.4) (2021-12-08)


### Miscellaneous

* **deps:** Update dependencies ([edacf52](https://www.github.com/ptarmiganlabs/butler-sos/commit/edacf52d3cd47c141c264c7984441f760ea4e47c))
* **deps:** update dependency prettier to v2.5.1 ([69d44b1](https://www.github.com/ptarmiganlabs/butler-sos/commit/69d44b19e456f81c769ebb395d01300acb2737d5))
* **deps:** update dependency snyk to v1.786.0 ([367579b](https://www.github.com/ptarmiganlabs/butler-sos/commit/367579b45e79d6dc5bf0cf8bfa39bf140ec62a98))

### [7.0.3](https://www.github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v7.0.2...butler-sos-v7.0.3) (2021-12-01)


### Miscellaneous

* **deps:** Update dependencies ([9275d4e](https://www.github.com/ptarmiganlabs/butler-sos/commit/9275d4e522b590768ccc63cd85fe6a276513e92e))

### [7.0.2](https://www.github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v7.0.1...butler-sos-v7.0.2) (2021-11-30)


### Bug Fixes

* Better handling of empty lists in config file ([f9b22d9](https://www.github.com/ptarmiganlabs/butler-sos/commit/f9b22d90d3114d51290ce99ce0aee01e958c41c3)), closes [#281](https://www.github.com/ptarmiganlabs/butler-sos/issues/281)

### [7.0.1](https://www.github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v7.0.0...butler-sos-v7.0.1) (2021-11-30)


### Bug Fixes

* Handle config file with no server tags in it ([d9e9799](https://www.github.com/ptarmiganlabs/butler-sos/commit/d9e9799d1d4826ba460421cf12f13ac5d249c433)), closes [#276](https://www.github.com/ptarmiganlabs/butler-sos/issues/276)


### Miscellaneous

* Updated dependencies ([53d63fa](https://www.github.com/ptarmiganlabs/butler-sos/commit/53d63fa27e4a431959cad0d3cc46a746fd6a1375))

## [7.0.0](https://www.github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v6.1.2...butler-sos-v7.0.0) (2021-11-28)


### ⚠ BREAKING CHANGES

* Add more control to user event MQTT msgs
* Starting phasing out log db support
* Log event handling in Butler SOS

### Features

* Add new features to anon telemetry msg ([3dc2fcb](https://www.github.com/ptarmiganlabs/butler-sos/commit/3dc2fcb8fe728b89d5d7cc6959d069a8eb80973f))
* Log event handling in Butler SOS ([c082dbb](https://www.github.com/ptarmiganlabs/butler-sos/commit/c082dbb837d29417164ff3cc64a5ae5013474494))
* MQTT topics follow QSEoW subsystems ([370a4ba](https://www.github.com/ptarmiganlabs/butler-sos/commit/370a4bac13cc4635e6de8ebdf766c0d134fc0e33))
* Starting phasing out log db support ([d51d0bd](https://www.github.com/ptarmiganlabs/butler-sos/commit/d51d0bd0cff47006d00c164be705521c69cffd77))
* **telemetry:** Show instance ID on startup ([c7277a7](https://www.github.com/ptarmiganlabs/butler-sos/commit/c7277a7b59f12d3ffa717ac216407275b2647e83))


### Bug Fixes

* Add port mappings to docker-compose file ([18436cc](https://www.github.com/ptarmiganlabs/butler-sos/commit/18436ccf9e6a79f9b69954ffaa08ddbf9f8ff5c8))
* All MQTT substopics now lower case ([6c4b209](https://www.github.com/ptarmiganlabs/butler-sos/commit/6c4b2090600a08a2176d5be22fad51f34c9b0966))
* Remove unused config file entries ([93a69b3](https://www.github.com/ptarmiganlabs/butler-sos/commit/93a69b379bb4f9ebed903dc536108e90f6d07f87))
* Replace outdated scheduling library ([8648cd3](https://www.github.com/ptarmiganlabs/butler-sos/commit/8648cd38dc3a351619fdee94d9ba483a1f154411))


### Refactoring

* Align handling of user and log events ([efe0064](https://www.github.com/ptarmiganlabs/butler-sos/commit/efe0064b23048d71760aefc5cb4a9522145e746f))


### feature

* Add more control to user event MQTT msgs ([85b7bbd](https://www.github.com/ptarmiganlabs/butler-sos/commit/85b7bbdfb69e3fafcefa303565f6b560421d3cd3))


### Miscellaneous

* **deps:** Update dependencies to latest ver. ([72b170b](https://www.github.com/ptarmiganlabs/butler-sos/commit/72b170b18a3f76c8a0ddd3577161b232d007edba))
* **deps:** update prom/prometheus docker tag to v2.31.1 ([62ead06](https://www.github.com/ptarmiganlabs/butler-sos/commit/62ead0616acbec933fd27efbc77d6aa62ac1c0c3))
* **deps:** Update systeminformation, snyk and eslint-plugin-import ([f9e9481](https://www.github.com/ptarmiganlabs/butler-sos/commit/f9e94817f280969228abfa4ac7a95a9bde42a222))
* Update dependencies ([b9be7ed](https://www.github.com/ptarmiganlabs/butler-sos/commit/b9be7ed250418ec8dfc8f061976f8ae3e8177f1c))

### [6.1.2](https://www.github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v6.1.1...butler-sos-v6.1.2) (2021-11-05)


### Bug Fixes

* **deps:** update dependency axios to ^0.24.0 ([c4a972a](https://www.github.com/ptarmiganlabs/butler-sos/commit/c4a972a34bf1bcbc4b9fe0b39fc3ebc1fa17c8f4))


### Miscellaneous

* **deps:** update dependency snyk to v1.753.0 ([1ad9292](https://www.github.com/ptarmiganlabs/butler-sos/commit/1ad929259f4beedeced5eed26c76dd63f1a7a308))
* **deps:** update prom/prometheus docker tag to v2.31.0 ([e6fbc32](https://www.github.com/ptarmiganlabs/butler-sos/commit/e6fbc320b644fd5e40e0d719b87e814cefacda50))

### [6.1.1](https://www.github.com/ptarmiganlabs/butler-sos/compare/butler-sos-v6.1.0...butler-sos-v6.1.1) (2021-10-19)


### Miscellaneous

* **deps:** pin dependency snyk to 1.741.0 ([92d2997](https://www.github.com/ptarmiganlabs/butler-sos/commit/92d29976f2a10312eaaaca3e145d3b0ec78c1056))
* **deps:** update influxdb docker tag to v1.8.10 ([99f5b27](https://www.github.com/ptarmiganlabs/butler-sos/commit/99f5b27f17676c49da894f667ebeaa9112075fee))
* **deps:** update prom/prometheus docker tag to v2.30.3 ([a35b331](https://www.github.com/ptarmiganlabs/butler-sos/commit/a35b33173d50e1dcc5c049eee2f41f369682a288))
* **deps:** Updated dependencies ([dbd3476](https://www.github.com/ptarmiganlabs/butler-sos/commit/dbd347640fe6fcd0107ddd7ace2cd3408fa94a6a))

## 6.1.0 (2021-10-19)


### Features

* **docker:** Build Docker images on Node 16 ([0f7c6e1](https://www.github.com/ptarmiganlabs/butler-sos/commit/0f7c6e1fe508012f843615204e02cd423fedc9ec))

### [6.0.2](https://www.github.com/ptarmiganlabs/butler-sos/compare/v6.0.1...v6.0.2) (2021-09-28)


### Bug Fixes

* **deps:** update dependency fastify-metrics to v8 ([f9e001a](https://www.github.com/ptarmiganlabs/butler-sos/commit/f9e001a3bc6e90cfbb7ad747123ff733914afa75))

### [6.0.1](https://www.github.com/ptarmiganlabs/butler-sos/compare/v6.0.0...v6.0.1) (2021-09-08)


### Bug Fixes

* Consistent log directory name ([4dd53ae](https://www.github.com/ptarmiganlabs/butler-sos/commit/4dd53aeefca77238fd94b99e3be14ac655094e75))
* Remove extra log files ([#209](https://www.github.com/ptarmiganlabs/butler-sos/issues/209)) ([f52eab8](https://www.github.com/ptarmiganlabs/butler-sos/commit/f52eab85758d9ffc57ba5ce262940e58d279b75d))

## [6.0.0](https://www.github.com/ptarmiganlabs/butler-sos/compare/v5.6.2...v6.0.0) (2021-09-03)


### ⚠ BREAKING CHANGES

* Extensive changes throughout the tool

### Features

* 1st version of user events monitoring, [#147](https://www.github.com/ptarmiganlabs/butler-sos/issues/147) ([c5468d7](https://www.github.com/ptarmiganlabs/butler-sos/commit/c5468d73b509a56b7ab08934ab654a59974963cf))
* add metrics for Prometheus ([7cee28d](https://www.github.com/ptarmiganlabs/butler-sos/commit/7cee28df1bc5a0f799a8309911acce86a35b85cb))
* Add Node.js metrics to Prometheus endpoint ([fb66055](https://www.github.com/ptarmiganlabs/butler-sos/commit/fb660554ae56a995602077823358578d88ce3221))
* Added Snyk scanning ([f6791b7](https://www.github.com/ptarmiganlabs/butler-sos/commit/f6791b74a072dc475e7a8120b7f0ccbcb1c0d081))
* Implements [#148](https://www.github.com/ptarmiganlabs/butler-sos/issues/148) ([4fde651](https://www.github.com/ptarmiganlabs/butler-sos/commit/4fde651bf0c21da77ea565869ccee9799801343d))
* Make TLS cert verification optional ([#178](https://www.github.com/ptarmiganlabs/butler-sos/issues/178)) ([132e502](https://www.github.com/ptarmiganlabs/butler-sos/commit/132e5023423d43b97578d96a9a27dad0f4e0f4c7))
* Session blacklist for InfluxDB, [#62](https://www.github.com/ptarmiganlabs/butler-sos/issues/62) ([de4849f](https://www.github.com/ptarmiganlabs/butler-sos/commit/de4849f1aa50b629f0d8da0e677f23d5acc620a8))
* Switch to Luxon instead of Moment. [#150](https://www.github.com/ptarmiganlabs/butler-sos/issues/150) ([358ff4a](https://www.github.com/ptarmiganlabs/butler-sos/commit/358ff4ae2c27b0168050e1bf01d682e13f4c82f5))
* User event tags in config file, [#153](https://www.github.com/ptarmiganlabs/butler-sos/issues/153) ([fc341d4](https://www.github.com/ptarmiganlabs/butler-sos/commit/fc341d4b6be39c3896ad83264ea7eca11890fd59))
* Work towards several issues ([5bed9fc](https://www.github.com/ptarmiganlabs/butler-sos/commit/5bed9fcb488f3e70a56af0f235c6cabd92fd1622))


### Bug Fixes

* 102, [#101](https://www.github.com/ptarmiganlabs/butler-sos/issues/101) ([396b267](https://www.github.com/ptarmiganlabs/butler-sos/commit/396b2676e7d68c7885fa58c0b3a9ab35a0978a41))


### Code Refactoring

* Extensive changes throughout the tool ([b0e5af3](https://www.github.com/ptarmiganlabs/butler-sos/commit/b0e5af3a0e8b0c899183f8acc739f01ade12c82a))

## [5.6.0](https://www.github.com/mountaindude/butler-sos/compare/v5.5.1...v5.6.0) (2021-07-27)


### Features

* 1st version of user events monitoring, [#147](https://www.github.com/mountaindude/butler-sos/issues/147) ([c5468d7](https://www.github.com/mountaindude/butler-sos/commit/c5468d73b509a56b7ab08934ab654a59974963cf))
* Implements [#148](https://www.github.com/mountaindude/butler-sos/issues/148) ([4fde651](https://www.github.com/mountaindude/butler-sos/commit/4fde651bf0c21da77ea565869ccee9799801343d))
* Session blacklist for InfluxDB, [#62](https://www.github.com/mountaindude/butler-sos/issues/62) ([de4849f](https://www.github.com/mountaindude/butler-sos/commit/de4849f1aa50b629f0d8da0e677f23d5acc620a8))
* Switch to Luxon instead of Moment. [#150](https://www.github.com/mountaindude/butler-sos/issues/150) ([358ff4a](https://www.github.com/mountaindude/butler-sos/commit/358ff4ae2c27b0168050e1bf01d682e13f4c82f5))
* User event tags in config file, [#153](https://www.github.com/mountaindude/butler-sos/issues/153) ([fc341d4](https://www.github.com/mountaindude/butler-sos/commit/fc341d4b6be39c3896ad83264ea7eca11890fd59))


### Bug Fixes

* 102, [#101](https://www.github.com/mountaindude/butler-sos/issues/101) ([396b267](https://www.github.com/mountaindude/butler-sos/commit/396b2676e7d68c7885fa58c0b3a9ab35a0978a41))
