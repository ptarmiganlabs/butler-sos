# Changelog

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
