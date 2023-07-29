# Changelog

## [10.0.0](https://github.com/ptarmiganlabs/butler-sos/compare/v9.4.1...v10.0.0) (2023-07-29)


### ⚠ BREAKING CHANGES

* Add external memory to uptime data in InfluxDB
* Restructure repository to get better working CI
* Add more control to user event MQTT msgs
* Starting phasing out log db support
* Log event handling in Butler SOS
* Extensive changes throughout the tool

### feature

* Add more control to user event MQTT msgs ([85b7bbd](https://github.com/ptarmiganlabs/butler-sos/commit/85b7bbdfb69e3fafcefa303565f6b560421d3cd3))


### Features

* Add command line options to Butler SOS ([e1d6577](https://github.com/ptarmiganlabs/butler-sos/commit/e1d65778878b2d16db3b099e5a83f53659201f01)), closes [#387](https://github.com/ptarmiganlabs/butler-sos/issues/387)
* Add external memory to uptime data in InfluxDB ([45447aa](https://github.com/ptarmiganlabs/butler-sos/commit/45447aae8b2b173d7725583191e9fd018f5c4767))
* add metrics for Prometheus ([7cee28d](https://github.com/ptarmiganlabs/butler-sos/commit/7cee28df1bc5a0f799a8309911acce86a35b85cb))
* Add new features to anon telemetry msg ([3dc2fcb](https://github.com/ptarmiganlabs/butler-sos/commit/3dc2fcb8fe728b89d5d7cc6959d069a8eb80973f))
* Add New Relic as destination for SenseOps metrics ([394945a](https://github.com/ptarmiganlabs/butler-sos/commit/394945af429fc80bec0ae40071a45b0f59647963))
* Add Node.js metrics to Prometheus endpoint ([fb66055](https://github.com/ptarmiganlabs/butler-sos/commit/fb660554ae56a995602077823358578d88ce3221))
* Add optional scrambling of user id for user events sent to New Relic ([33364f5](https://github.com/ptarmiganlabs/butler-sos/commit/33364f591ec5674ed85c90cb46407d183a1ab0fc)), closes [#398](https://github.com/ptarmiganlabs/butler-sos/issues/398)
* Add stand-alone executable (Windows, macOS, Linux) for Butler SOS ([4573543](https://github.com/ptarmiganlabs/butler-sos/commit/4573543b967bb430dd67861bf2c9418ae6895510)), closes [#314](https://github.com/ptarmiganlabs/butler-sos/issues/314)
* Add support for storing Sense engine warning/error log messages in InfluxDB. ([40d784f](https://github.com/ptarmiganlabs/butler-sos/commit/40d784f037c5db57ab9ad4c5931303ae61bf914b)), closes [#435](https://github.com/ptarmiganlabs/butler-sos/issues/435)
* Add virus/malware scanning of standalone binaries during build ([2aaf091](https://github.com/ptarmiganlabs/butler-sos/commit/2aaf0919b62e724b2063e17572ac2ba84364c4a7)), closes [#449](https://github.com/ptarmiganlabs/butler-sos/issues/449)
* Added Snyk scanning ([f6791b7](https://github.com/ptarmiganlabs/butler-sos/commit/f6791b74a072dc475e7a8120b7f0ccbcb1c0d081))
* Better logging when warnings and errors occur ([f8abc64](https://github.com/ptarmiganlabs/butler-sos/commit/f8abc6427c09c99882c02b259ee1b8a831cfe332)), closes [#404](https://github.com/ptarmiganlabs/butler-sos/issues/404)
* Create stand-alone executables for Butler SOS ([66039b9](https://github.com/ptarmiganlabs/butler-sos/commit/66039b99f1f82049f00883a168391b8621174291))
* Create stand-alone executables for Butler SOS ([5a7c6e7](https://github.com/ptarmiganlabs/butler-sos/commit/5a7c6e7857cbdfbce0840a76aa560c377d50d784))
* Create stand-alone executables for Butler SOS ([628b020](https://github.com/ptarmiganlabs/butler-sos/commit/628b020cde10531d4792be4a70d0e185cc0725b9))
* Create stand-alone executables for Butler SOS ([21775b8](https://github.com/ptarmiganlabs/butler-sos/commit/21775b8443415aa3f11fbc58117351c170438d21)), closes [#327](https://github.com/ptarmiganlabs/butler-sos/issues/327)
* Create stand-alone executables for Butler SOS ([77b10f3](https://github.com/ptarmiganlabs/butler-sos/commit/77b10f3b1e7c796c3817b61b80255393aacb6b07)), closes [#314](https://github.com/ptarmiganlabs/butler-sos/issues/314)
* **docker:** Build Docker images on Node 16 ([0f7c6e1](https://github.com/ptarmiganlabs/butler-sos/commit/0f7c6e1fe508012f843615204e02cd423fedc9ec))
* Log event handling in Butler SOS ([c082dbb](https://github.com/ptarmiganlabs/butler-sos/commit/c082dbb837d29417164ff3cc64a5ae5013474494))
* Make it possible to specify one or more New Relic account credentials via command line ([66cda6d](https://github.com/ptarmiganlabs/butler-sos/commit/66cda6d0ab9b9a5d1dd853ec7b8008115ad0f8b5)), closes [#429](https://github.com/ptarmiganlabs/butler-sos/issues/429)
* MQTT topics follow QSEoW subsystems ([370a4ba](https://github.com/ptarmiganlabs/butler-sos/commit/370a4bac13cc4635e6de8ebdf766c0d134fc0e33))
* Scan for vulnerabilities as part of each release ([9d0d18d](https://github.com/ptarmiganlabs/butler-sos/commit/9d0d18df77e7ddc989cb0b1752f7d8c5b8119cd9)), closes [#361](https://github.com/ptarmiganlabs/butler-sos/issues/361)
* Send engine, proxy and session metrics to New Relic. ([0b52eb5](https://github.com/ptarmiganlabs/butler-sos/commit/0b52eb5cb222f03f7a4b18eeafdb9f700758b7ee))
* Sign windows binaries ([9d2a311](https://github.com/ptarmiganlabs/butler-sos/commit/9d2a311fd697154d518d28692684cb52596c1a45))
* Specify zero or more New Relic credentials via command line option ([fccea2a](https://github.com/ptarmiganlabs/butler-sos/commit/fccea2a053e644596073af49a510e93952760e30)), closes [#429](https://github.com/ptarmiganlabs/butler-sos/issues/429)
* Starting phasing out log db support ([d51d0bd](https://github.com/ptarmiganlabs/butler-sos/commit/d51d0bd0cff47006d00c164be705521c69cffd77))
* support for sending metrics and events to multiple New Relic accounts ([a872181](https://github.com/ptarmiganlabs/butler-sos/commit/a8721816dffac938ccc3b9783a1fec1e17d7cdeb)), closes [#417](https://github.com/ptarmiganlabs/butler-sos/issues/417)
* **telemetry:** Replace existing telemetry solution with PostHog ([0f60edc](https://github.com/ptarmiganlabs/butler-sos/commit/0f60edcdd421fd4956b8e26897ad75b4239fad26)), closes [#523](https://github.com/ptarmiganlabs/butler-sos/issues/523)
* **telemetry:** Show instance ID on startup ([c7277a7](https://github.com/ptarmiganlabs/butler-sos/commit/c7277a7b59f12d3ffa717ac216407275b2647e83))
* Write info on startup about execution type ([4e99e5f](https://github.com/ptarmiganlabs/butler-sos/commit/4e99e5f34379914c0f138f828ddeab1c5f84c5a5)), closes [#430](https://github.com/ptarmiganlabs/butler-sos/issues/430)


### Bug Fixes

* Add missing XML log appender file for QS engine service ([6b0f79a](https://github.com/ptarmiganlabs/butler-sos/commit/6b0f79a1a224e79c38fe24ca9b5c3c0132648999)), closes [#433](https://github.com/ptarmiganlabs/butler-sos/issues/433)
* Add port mappings to docker-compose file ([18436cc](https://github.com/ptarmiganlabs/butler-sos/commit/18436ccf9e6a79f9b69954ffaa08ddbf9f8ff5c8))
* add Prometheus status to telemetry data ([6e05c7e](https://github.com/ptarmiganlabs/butler-sos/commit/6e05c7e13e389ce34ae8774791234ed10bfbac06))
* All MQTT substopics now lower case ([6c4b209](https://github.com/ptarmiganlabs/butler-sos/commit/6c4b2090600a08a2176d5be22fad51f34c9b0966))
* App signing for macOS ([3585a70](https://github.com/ptarmiganlabs/butler-sos/commit/3585a701b8296892bee4862338179136a2526293))
* Better handling of empty lists in config file ([f9b22d9](https://github.com/ptarmiganlabs/butler-sos/commit/f9b22d90d3114d51290ce99ce0aee01e958c41c3)), closes [#281](https://github.com/ptarmiganlabs/butler-sos/issues/281)
* Broken CI for macOS executable ([2b96667](https://github.com/ptarmiganlabs/butler-sos/commit/2b96667a6121e41e4c9b672a64b8e4487b5bf1c1))
* Broken CI for macOS executable ([be80745](https://github.com/ptarmiganlabs/butler-sos/commit/be80745a8b1f0b4c4727860f573348630ffeb1ae))
* Build process broken ([5fb2a51](https://github.com/ptarmiganlabs/butler-sos/commit/5fb2a51c0c39eca775bb5e6f51b1c11fbeab4665))
* CI debugging ([783a59b](https://github.com/ptarmiganlabs/butler-sos/commit/783a59b38f3542fb8352eb01ceece1a4fb0e90a4))
* CI tweaking ([49f2268](https://github.com/ptarmiganlabs/butler-sos/commit/49f22680171451484b5f1282c76c92f0ef6569e3))
* CI tweaking ([3e0d357](https://github.com/ptarmiganlabs/butler-sos/commit/3e0d357f0456d2ee5dfdc42ae87f6e6dce86c677))
* CI tweaking ([56d25de](https://github.com/ptarmiganlabs/butler-sos/commit/56d25de0ef4cdf0c4ac6417e5083e88c50f97e6b))
* Clean up Docker images ([d818060](https://github.com/ptarmiganlabs/butler-sos/commit/d81806038e00e4eeb6837d255918ea545f979102)), closes [#363](https://github.com/ptarmiganlabs/butler-sos/issues/363)
* Compress stand-alone binaries ([028c9ab](https://github.com/ptarmiganlabs/butler-sos/commit/028c9ab23695e22f4f44f09ee4a1e89b10c52efa))
* Consistent log directory name ([4dd53ae](https://github.com/ptarmiganlabs/butler-sos/commit/4dd53aeefca77238fd94b99e3be14ac655094e75))
* Debug standalone executables ([298b076](https://github.com/ptarmiganlabs/butler-sos/commit/298b0767810b7ccdd80efaf99c5ef1ffec8fcb5a))
* **deps:** update dependency axios to ^0.24.0 ([c4a972a](https://github.com/ptarmiganlabs/butler-sos/commit/c4a972a34bf1bcbc4b9fe0b39fc3ebc1fa17c8f4))
* **deps:** update dependency axios to ^0.26.0 ([6a8fafc](https://github.com/ptarmiganlabs/butler-sos/commit/6a8fafc88eafd3c620a4981482cc86785fa3d62b))
* **deps:** update dependency axios to ^0.27.0 ([efce7c8](https://github.com/ptarmiganlabs/butler-sos/commit/efce7c82896c8d27d68fb3fe75b5f66ad86b3e5a))
* **deps:** update dependency eslint-config-prettier to v8.5.0 ([3331840](https://github.com/ptarmiganlabs/butler-sos/commit/3331840476da16287b891c0f142d38e65b0aebaf))
* **deps:** update dependency eslint-config-prettier to v8.5.0 ([ab02342](https://github.com/ptarmiganlabs/butler-sos/commit/ab023420e27797cfa4bd2fff0b06cda47d8997d4))
* **deps:** update dependency fastify-metrics to v8 ([f9e001a](https://github.com/ptarmiganlabs/butler-sos/commit/f9e001a3bc6e90cfbb7ad747123ff733914afa75))
* **deps:** update dependency url-join to v5 ([ecc997f](https://github.com/ptarmiganlabs/butler-sos/commit/ecc997f3fb082bb7f8209d97a71ed6d47363a739))
* **deps:** update dependency url-join to v5 ([2a37964](https://github.com/ptarmiganlabs/butler-sos/commit/2a379648ff09b02d771e6d8f4ba554b2379e0c51))
* **docs:** Add missing New Relic entries to sample config file ([9a70111](https://github.com/ptarmiganlabs/butler-sos/commit/9a701111ab5086e271cd3e735b19c94613669eb7)), closes [#407](https://github.com/ptarmiganlabs/butler-sos/issues/407)
* Fix broken Windows build pipeline ([72ab01f](https://github.com/ptarmiganlabs/butler-sos/commit/72ab01f356a3707c3ca018bc7714aa0931d3f5fe))
* Fix macOS app signing ([94bd512](https://github.com/ptarmiganlabs/butler-sos/commit/94bd5121d80dbe03056c1c2fa4de8aaf3577fcb8))
* Fixing broken CI ([f6cfc9a](https://github.com/ptarmiganlabs/butler-sos/commit/f6cfc9a6eddb5c8a78797e9ba6a0cd9513e45270))
* Handle config file with no server tags in it ([d9e9799](https://github.com/ptarmiganlabs/butler-sos/commit/d9e9799d1d4826ba460421cf12f13ac5d249c433)), closes [#276](https://github.com/ptarmiganlabs/butler-sos/issues/276)
* Improve logs when getting app names ([20eb302](https://github.com/ptarmiganlabs/butler-sos/commit/20eb30211fecd8263421ca1b0783484a2f120e7c))
* Include New Relic status in telemtry data ([23c292c](https://github.com/ptarmiganlabs/butler-sos/commit/23c292cae4fd0dd18fec100641952a21c425ad3f))
* Incorrect comments in sample docker-compose files ([326cf58](https://github.com/ptarmiganlabs/butler-sos/commit/326cf5846fde12f5f149be96dc66b284a8dc2422)), closes [#439](https://github.com/ptarmiganlabs/butler-sos/issues/439)
* Incorrect parsing of git tags &gt; Incorrect Docker tags ([728c16a](https://github.com/ptarmiganlabs/butler-sos/commit/728c16a5f9cbdae8d36686fc8c75a8aea97f49f7))
* Log events now correctly sent to New Relic, incl engine log events. ([54123fb](https://github.com/ptarmiganlabs/butler-sos/commit/54123fb280ac167eddfbd19e1f60cea5882eeb51)), closes [#432](https://github.com/ptarmiganlabs/butler-sos/issues/432)
* macOS app signing ([74c7559](https://github.com/ptarmiganlabs/butler-sos/commit/74c75591d347e5ab5b647c73ddec34480df0ab4b))
* Make get app names logging verbose, not info ([146bd24](https://github.com/ptarmiganlabs/butler-sos/commit/146bd243bd637401f3108f703968af4a98a78523)), closes [#297](https://github.com/ptarmiganlabs/butler-sos/issues/297)
* Move docker-compose demo files to docs folder ([9f7a063](https://github.com/ptarmiganlabs/butler-sos/commit/9f7a0635b66412cbaa18e151ff6371cc1a64692e)), closes [#362](https://github.com/ptarmiganlabs/butler-sos/issues/362)
* Properly show warnings when trying to send log events to New Relic ([8739c48](https://github.com/ptarmiganlabs/butler-sos/commit/8739c48eefb987de7d4e58d72bb9c50b6d6cfb57)), closes [#411](https://github.com/ptarmiganlabs/butler-sos/issues/411)
* Remove development only files from release ZIPs ([1ac453c](https://github.com/ptarmiganlabs/butler-sos/commit/1ac453c58707a828f2e138065e5f64f3aaabf5d9))
* Remove extra log files ([#209](https://github.com/ptarmiganlabs/butler-sos/issues/209)) ([f52eab8](https://github.com/ptarmiganlabs/butler-sos/commit/f52eab85758d9ffc57ba5ce262940e58d279b75d))
* Remove unused config file entries ([93a69b3](https://github.com/ptarmiganlabs/butler-sos/commit/93a69b379bb4f9ebed903dc536108e90f6d07f87))
* Replace outdated scheduling library ([8648cd3](https://github.com/ptarmiganlabs/butler-sos/commit/8648cd38dc3a351619fdee94d9ba483a1f154411))
* Restructure repository to get better working CI ([dec58ce](https://github.com/ptarmiganlabs/butler-sos/commit/dec58ce7943f73957c8159573246a9fef5ddaf26)), closes [#357](https://github.com/ptarmiganlabs/butler-sos/issues/357)
* Send correct tags to Prometheus endpoint ([04f735e](https://github.com/ptarmiganlabs/butler-sos/commit/04f735e65aca1dd02b5aa176e78052f7f38df9e9)), closes [#422](https://github.com/ptarmiganlabs/butler-sos/issues/422)
* Slim down release ZIP files ([94dc3c5](https://github.com/ptarmiganlabs/butler-sos/commit/94dc3c56299b88a559200306ae6e7620037842bf))
* Trying to fix broken CI ([7751063](https://github.com/ptarmiganlabs/butler-sos/commit/7751063d2045402d63ad1cd614d7220df68fc46e))
* Unmatched server tags in sample YAML config file ([5a9d3b6](https://github.com/ptarmiganlabs/butler-sos/commit/5a9d3b67010202b58effbc22da6a17924a6e7ee0)), closes [#438](https://github.com/ptarmiganlabs/butler-sos/issues/438)


### Miscellaneous

* Add automated release handling ([738c209](https://github.com/ptarmiganlabs/butler-sos/commit/738c2094d2bdf57a3c14793549f071d86c68abe6))
* Building Docker imgs in GH Actions ([af91c11](https://github.com/ptarmiganlabs/butler-sos/commit/af91c1152f9081a6a01e042d1da1a3fd43f3531b))
* **deps:** bump ansi-regex from 5.0.0 to 5.0.1 in /src ([232945c](https://github.com/ptarmiganlabs/butler-sos/commit/232945c95adf1787256bf09f8412b191018580c3))
* **deps:** bump color-string from 1.5.3 to 1.6.0 in /src ([4c64b3b](https://github.com/ptarmiganlabs/butler-sos/commit/4c64b3b84dc41390dd54307f94d8aa075c843461))
* **deps:** bump fastify from 4.5.3 to 4.8.1 ([42d6f52](https://github.com/ptarmiganlabs/butler-sos/commit/42d6f52024f5aa10239348fd94dd9750a4b2aaaf))
* **deps:** bump moment from 2.29.1 to 2.29.2 ([120888d](https://github.com/ptarmiganlabs/butler-sos/commit/120888dc58812647f6d94d90945c2bb6599e58f1))
* **deps:** pin dependencies ([4b3ab8f](https://github.com/ptarmiganlabs/butler-sos/commit/4b3ab8f7f4686501d1118d99d3db558f3eb6c90e))
* **deps:** pin dependencies ([#61](https://github.com/ptarmiganlabs/butler-sos/issues/61)) ([d15cb60](https://github.com/ptarmiganlabs/butler-sos/commit/d15cb60b864b707575512c5dc5e99dcadc63d11b))
* **deps:** pin dependency snyk to 1.675.0 ([#63](https://github.com/ptarmiganlabs/butler-sos/issues/63)) ([a2024aa](https://github.com/ptarmiganlabs/butler-sos/commit/a2024aaa3bb4855687a04e3c1671dcbce277a8d3))
* **deps:** pin dependency snyk to 1.696.0 ([d05d4de](https://github.com/ptarmiganlabs/butler-sos/commit/d05d4de1e4c657c1dcb175d577b47c9fc41313b8))
* **deps:** pin dependency snyk to 1.741.0 ([92d2997](https://github.com/ptarmiganlabs/butler-sos/commit/92d29976f2a10312eaaaca3e145d3b0ec78c1056))
* **deps:** Revert release-please version to 2.29.0 ([be4d783](https://github.com/ptarmiganlabs/butler-sos/commit/be4d783b6349d3f58ae0c6a3f8704295eef9d6a5))
* **deps:** update actions/checkout action to v3 ([9fea288](https://github.com/ptarmiganlabs/butler-sos/commit/9fea28840110dccf7095132dc66c79296b0cd1d5))
* **deps:** update actions/checkout action to v3 ([4acf81c](https://github.com/ptarmiganlabs/butler-sos/commit/4acf81ce8ec8209992a75806857dec902dc8eae8))
* **deps:** update actions/download-artifact action to v3 ([c8ea704](https://github.com/ptarmiganlabs/butler-sos/commit/c8ea7042c20be155695b03c321ef3ffa9a776b11))
* **deps:** update actions/download-artifact action to v3 ([3f25405](https://github.com/ptarmiganlabs/butler-sos/commit/3f25405681c75b1b1651c243a2d4c3dcca609089))
* **deps:** update actions/upload-artifact action to v3 ([776c4e9](https://github.com/ptarmiganlabs/butler-sos/commit/776c4e987aad46a579d10a1930859e4565ad3473))
* **deps:** update actions/upload-artifact action to v3 ([4136edd](https://github.com/ptarmiganlabs/butler-sos/commit/4136eddf2c8530d0889f52583548cb3eed119b49))
* **deps:** Update dependencies ([c111f1c](https://github.com/ptarmiganlabs/butler-sos/commit/c111f1c31eb3f4b74b36e6a6baa9bc0b763c11c8))
* **deps:** Update dependencies ([edacf52](https://github.com/ptarmiganlabs/butler-sos/commit/edacf52d3cd47c141c264c7984441f760ea4e47c))
* **deps:** Update dependencies ([9275d4e](https://github.com/ptarmiganlabs/butler-sos/commit/9275d4e522b590768ccc63cd85fe6a276513e92e))
* **deps:** Update dependencies to latest ver. ([72b170b](https://github.com/ptarmiganlabs/butler-sos/commit/72b170b18a3f76c8a0ddd3577161b232d007edba))
* **deps:** Update dependencies to stay safe & secure ([bf91c4f](https://github.com/ptarmiganlabs/butler-sos/commit/bf91c4f05a45d1d4e5422576aee082381453c649))
* **deps:** Update dependencies to stay safe & secure ([600b22d](https://github.com/ptarmiganlabs/butler-sos/commit/600b22d745b1df46a47a480708ecbb1b7f393213))
* **deps:** Update dependencies to stay safe & secure ([2142590](https://github.com/ptarmiganlabs/butler-sos/commit/2142590e34ab672ed04cb9d4307c342214deef58))
* **deps:** Update dependencies to stay safe and secure ([48efac0](https://github.com/ptarmiganlabs/butler-sos/commit/48efac0041dbccf604b325f5732c40df424b9172))
* **deps:** Update dependencies to stay safe and secure ([e7de02b](https://github.com/ptarmiganlabs/butler-sos/commit/e7de02b1d8244c1a62f1a60b8f45d39212bf493c))
* **deps:** update dependency prettier to v2.4.1 ([4701416](https://github.com/ptarmiganlabs/butler-sos/commit/4701416ef21d182e377e539c7ba3f3778580086c))
* **deps:** update dependency prettier to v2.5.1 ([69d44b1](https://github.com/ptarmiganlabs/butler-sos/commit/69d44b19e456f81c769ebb395d01300acb2737d5))
* **deps:** update dependency prettier to v2.6.1 ([c470af2](https://github.com/ptarmiganlabs/butler-sos/commit/c470af240a3803b3aa63ecb4267c35ee841f4137))
* **deps:** update dependency prettier to v2.6.2 ([04456f7](https://github.com/ptarmiganlabs/butler-sos/commit/04456f752f11709ca67a755b99a00e60ad43b248))
* **deps:** update dependency snyk to v1.725.0 ([80c1c90](https://github.com/ptarmiganlabs/butler-sos/commit/80c1c90bdf009a94dcd225118b5733fa50e905a9))
* **deps:** update dependency snyk to v1.753.0 ([1ad9292](https://github.com/ptarmiganlabs/butler-sos/commit/1ad929259f4beedeced5eed26c76dd63f1a7a308))
* **deps:** update dependency snyk to v1.786.0 ([367579b](https://github.com/ptarmiganlabs/butler-sos/commit/367579b45e79d6dc5bf0cf8bfa39bf140ec62a98))
* **deps:** update dependency snyk to v1.788.0 ([c4cfe15](https://github.com/ptarmiganlabs/butler-sos/commit/c4cfe158fcf5b27e99efd1a2a09bf7b97409af17))
* **deps:** update dependency snyk to v1.833.0 ([#64](https://github.com/ptarmiganlabs/butler-sos/issues/64)) ([b800b85](https://github.com/ptarmiganlabs/butler-sos/commit/b800b852b524fc5c9ae1a1d748ebed814724815a))
* **deps:** update dependency snyk to v1.840.0 ([7a89d65](https://github.com/ptarmiganlabs/butler-sos/commit/7a89d657c9ead49a76bf632900308e26a8abbc4c))
* **deps:** update dependency snyk to v1.852.0 ([6bc5ba7](https://github.com/ptarmiganlabs/butler-sos/commit/6bc5ba7f9ffdb0a7e134073bcec07ef56926b2bb))
* **deps:** Update deps ([b13dc30](https://github.com/ptarmiganlabs/butler-sos/commit/b13dc301c1f10e8a336079ec3d7da9cc343f4f5c))
* **deps:** update docker/build-push-action action to v3 ([c04b422](https://github.com/ptarmiganlabs/butler-sos/commit/c04b4226e9ce0c8dde904ceb986bccf66c6a4aac))
* **deps:** update docker/login-action action to v2 ([907c6bf](https://github.com/ptarmiganlabs/butler-sos/commit/907c6bf485b3daa4b6191880f623c958a567c7e8))
* **deps:** update docker/metadata-action action to v4 ([99f1fbf](https://github.com/ptarmiganlabs/butler-sos/commit/99f1fbffc9fdad3129ab3096c1dd9f3a3ac38b8f))
* **deps:** update docker/setup-buildx-action action to v2 ([c488648](https://github.com/ptarmiganlabs/butler-sos/commit/c488648b7e929849a7bb0f64cee144efd8dce8d6))
* **deps:** update docker/setup-qemu-action action to v2 ([b1352a2](https://github.com/ptarmiganlabs/butler-sos/commit/b1352a274ea334acb4ca73293ccb2c40bc209dac))
* **deps:** update github/codeql-action action to v2 ([f01bfad](https://github.com/ptarmiganlabs/butler-sos/commit/f01bfadd210f90ba0f7c062d41f6f41e7fff4508))
* **deps:** update googlecloudplatform/release-please-action action to v2.32.0 ([2c92615](https://github.com/ptarmiganlabs/butler-sos/commit/2c92615e28b34c5dd65f0eb6090844d301f5304c))
* **deps:** update googlecloudplatform/release-please-action action to v2.32.0 ([0643721](https://github.com/ptarmiganlabs/butler-sos/commit/06437214bfe78b3cdee559dba2ba0f4edc9479be))
* **deps:** update googlecloudplatform/release-please-action action to v3 ([278dbfe](https://github.com/ptarmiganlabs/butler-sos/commit/278dbfe281147cec0c1f60b35a8eb2c035285ef8))
* **deps:** update influxdb docker tag to v1.8.10 ([99f5b27](https://github.com/ptarmiganlabs/butler-sos/commit/99f5b27f17676c49da894f667ebeaa9112075fee))
* **deps:** update influxdb docker tag to v1.8.9 ([#66](https://github.com/ptarmiganlabs/butler-sos/issues/66)) ([3aca452](https://github.com/ptarmiganlabs/butler-sos/commit/3aca452183f52093e543615cb3c071620bfd6498))
* **deps:** update node.js to v18 ([9276b68](https://github.com/ptarmiganlabs/butler-sos/commit/9276b68a8a756661c98d872bc5432d202ac091c9))
* **deps:** update node.js to v19 ([ba72504](https://github.com/ptarmiganlabs/butler-sos/commit/ba72504eb2ab1a6e6e3f613ce94b2c07f7eb8d97))
* **deps:** update prom/prometheus docker tag to v2.30.0 ([b6fc8d8](https://github.com/ptarmiganlabs/butler-sos/commit/b6fc8d8f5fb18aafd46d5671f174b0ec59d203a4))
* **deps:** update prom/prometheus docker tag to v2.30.0 ([9b16df4](https://github.com/ptarmiganlabs/butler-sos/commit/9b16df4405ff026646a1210306d9da8c867df71c))
* **deps:** update prom/prometheus docker tag to v2.30.3 ([a35b331](https://github.com/ptarmiganlabs/butler-sos/commit/a35b33173d50e1dcc5c049eee2f41f369682a288))
* **deps:** update prom/prometheus docker tag to v2.31.0 ([e6fbc32](https://github.com/ptarmiganlabs/butler-sos/commit/e6fbc320b644fd5e40e0d719b87e814cefacda50))
* **deps:** update prom/prometheus docker tag to v2.31.1 ([62ead06](https://github.com/ptarmiganlabs/butler-sos/commit/62ead0616acbec933fd27efbc77d6aa62ac1c0c3))
* **deps:** Update systeminformation, snyk and eslint-plugin-import ([f9e9481](https://github.com/ptarmiganlabs/butler-sos/commit/f9e94817f280969228abfa4ac7a95a9bde42a222))
* **deps:** Updated dependencies ([7836739](https://github.com/ptarmiganlabs/butler-sos/commit/7836739c27eb2fe95e51c87232674ebceba6e907))
* **deps:** Updated dependencies ([dbd3476](https://github.com/ptarmiganlabs/butler-sos/commit/dbd347640fe6fcd0107ddd7ace2cd3408fa94a6a))
* **deps:** Updated dependencies ([d95c1df](https://github.com/ptarmiganlabs/butler-sos/commit/d95c1dfc9151f418a80ca12750ee6f9290704daf))
* **deps:** Updated deps to latest versions ([42a8907](https://github.com/ptarmiganlabs/butler-sos/commit/42a890702c47ad3e0b3391dcd535c24fafc9823b))
* **deps:** Upgrade Docker build pipeline ([c6ad9c7](https://github.com/ptarmiganlabs/butler-sos/commit/c6ad9c7e80d28c524d934bf07e818fceebf1b1b0))
* **deps:** Upgrade release mgmt deps ([adfb732](https://github.com/ptarmiganlabs/butler-sos/commit/adfb7322d47fa43efa4e6ca4ece1c6ced1675857))
* **deps:** Upgrade release-please ([0dd138b](https://github.com/ptarmiganlabs/butler-sos/commit/0dd138be1c1825bb85f2f7cc80b1e56fd8923427))
* fix release-please config ([fa6610c](https://github.com/ptarmiganlabs/butler-sos/commit/fa6610c0827f09b40efa94c1366596316a7ce2d6))
* Lock package versions, add keyword in package file ([9116f22](https://github.com/ptarmiganlabs/butler-sos/commit/9116f22efbfe45fef906c16ce1cbcba700de20b8))
* **master:** release 7.1.1 ([6b1e57e](https://github.com/ptarmiganlabs/butler-sos/commit/6b1e57e7211755a1bee33fc9c35199610fa766e8))
* **master:** release 7.1.10 ([dcafe58](https://github.com/ptarmiganlabs/butler-sos/commit/dcafe58204957dc3f4f5621def3620d2471b0d03))
* **master:** release 7.1.11 ([a8a2824](https://github.com/ptarmiganlabs/butler-sos/commit/a8a282474f59e63c41c19fe6a6b08712a9ea25fe))
* **master:** release 7.1.2 ([c580aa1](https://github.com/ptarmiganlabs/butler-sos/commit/c580aa1a5ac61dcbbfe0245473f7f6387f7e3462))
* **master:** release 7.1.3 ([6502a45](https://github.com/ptarmiganlabs/butler-sos/commit/6502a4534cc27068c4703d23bd9957ea7392e133))
* **master:** release 7.1.4 ([f601946](https://github.com/ptarmiganlabs/butler-sos/commit/f6019466faef5b5fd411f22edab9c6747eaf2b9c))
* **master:** release 7.1.5 ([bfdca9c](https://github.com/ptarmiganlabs/butler-sos/commit/bfdca9cf50ea0c876ce3a45b99ad217de7528664))
* **master:** release 7.1.6 ([4d27cca](https://github.com/ptarmiganlabs/butler-sos/commit/4d27cca69c1a604b6b83d8eadb2f81bff0dd1306))
* **master:** release 7.1.7 ([24474ee](https://github.com/ptarmiganlabs/butler-sos/commit/24474ee1fb93da76f6919e60178b1ff94c3c20e7))
* **master:** release 7.1.8 ([3eb45b9](https://github.com/ptarmiganlabs/butler-sos/commit/3eb45b90f3121cc3704afadb8198f9ec1e605c55))
* **master:** release 7.1.9 ([b80d061](https://github.com/ptarmiganlabs/butler-sos/commit/b80d061c80b0eb2675aa21b49b628495a7fe62c4))
* **master:** release 8.0.0 ([e9381c0](https://github.com/ptarmiganlabs/butler-sos/commit/e9381c00003520f94c8d0260a1ef9d0ae7ee3e59))
* **master:** release 8.1.0 ([f3c8d4e](https://github.com/ptarmiganlabs/butler-sos/commit/f3c8d4e8b4b6e62eacb4374d007b42538b1645c6))
* **master:** release 8.1.1 ([44871e3](https://github.com/ptarmiganlabs/butler-sos/commit/44871e34fae7cd171d41a85c84f585942644a664))
* **master:** release 8.1.2 ([5d495f5](https://github.com/ptarmiganlabs/butler-sos/commit/5d495f5efc4c40313971fd7dd75408019882490b))
* **master:** release 9.0.0 ([28e3171](https://github.com/ptarmiganlabs/butler-sos/commit/28e31711630e584e9ace5d59736922fb1db54dae))
* **master:** release 9.0.1 ([18d20d6](https://github.com/ptarmiganlabs/butler-sos/commit/18d20d6a79549ba50e5798f9d692ad483888d02e))
* **master:** release 9.0.2 ([ffe5b39](https://github.com/ptarmiganlabs/butler-sos/commit/ffe5b399f838d747c42fa3c7423b5108aa94f24b))
* **master:** release 9.1.0 ([844eaa6](https://github.com/ptarmiganlabs/butler-sos/commit/844eaa658c5bb903329929582cbec4852b64e41b))
* **master:** release 9.2.0 ([f20a9e8](https://github.com/ptarmiganlabs/butler-sos/commit/f20a9e89fdc965745ff4540b2797dcfe4fff1468))
* **master:** release 9.2.1 ([22bdccf](https://github.com/ptarmiganlabs/butler-sos/commit/22bdccf94fe5bc76ce96d0789de24c121b0e20b3))
* **master:** release 9.2.2 ([fa60bf6](https://github.com/ptarmiganlabs/butler-sos/commit/fa60bf6e06d668a237c689c44b720410dd420393))
* **master:** release 9.3.0 ([bbe9d64](https://github.com/ptarmiganlabs/butler-sos/commit/bbe9d6485cdef7027318d6ae9115b1a97f0635bf))
* **master:** release 9.3.1 ([d3fc9e6](https://github.com/ptarmiganlabs/butler-sos/commit/d3fc9e6be5dea516629a436298f513d1d46f9681))
* **master:** release 9.3.2 ([6211b5a](https://github.com/ptarmiganlabs/butler-sos/commit/6211b5ab0404dd95649971a734d6ced6383ba9f1))
* **master:** release 9.3.3 ([6d920a5](https://github.com/ptarmiganlabs/butler-sos/commit/6d920a5c9a9b525c36029cfc686b3b550d4e37c2))
* **master:** release 9.4.0 ([084b336](https://github.com/ptarmiganlabs/butler-sos/commit/084b336da413466dfc1df0be53fbf7fd19e7561d))
* **master:** release 9.4.1 ([5888553](https://github.com/ptarmiganlabs/butler-sos/commit/58885533cf077b251d70c046f35b3090f0d85fca))
* **master:** release butler-sos 7.0.7 ([298cba0](https://github.com/ptarmiganlabs/butler-sos/commit/298cba06c792175659d083c723d7db4850fc0ede))
* **master:** release butler-sos 7.0.8 ([5957a8e](https://github.com/ptarmiganlabs/butler-sos/commit/5957a8ee21fdb182b155619103b7e5b22b86c76e))
* **master:** release butler-sos 7.1.0 ([ec742b0](https://github.com/ptarmiganlabs/butler-sos/commit/ec742b08cc0c0d21b20a66d2d4b328adc7a5c156))
* release 5.6.0 ([#59](https://github.com/ptarmiganlabs/butler-sos/issues/59)).  ([5d1a09f](https://github.com/ptarmiganlabs/butler-sos/commit/5d1a09f7a99a53a5df98d7e869dc17d35e8b8d50))
* release 5.7.0 ([#62](https://github.com/ptarmiganlabs/butler-sos/issues/62)) ([d4de22d](https://github.com/ptarmiganlabs/butler-sos/commit/d4de22d873f035dbd318e01c27760d088ea8c4f9))
* release 6.0.0 ([#204](https://github.com/ptarmiganlabs/butler-sos/issues/204)) ([15baa2a](https://github.com/ptarmiganlabs/butler-sos/commit/15baa2ade702cb4ebd4cbbeecbe3ce1c7e14fc80))
* release 6.0.1 ([#211](https://github.com/ptarmiganlabs/butler-sos/issues/211)) ([603d699](https://github.com/ptarmiganlabs/butler-sos/commit/603d6996eb08f0190337b8709a11bcfbccd661e6))
* release 6.0.2 ([85e7851](https://github.com/ptarmiganlabs/butler-sos/commit/85e785190d520665132070811747408c5804ab94))
* release master ([4bf0445](https://github.com/ptarmiganlabs/butler-sos/commit/4bf044559f818bbd25998c6f5c9760d8c6ce3a44))
* release master ([10819dd](https://github.com/ptarmiganlabs/butler-sos/commit/10819dd1a1a7f95a96b8b4529cf2b47896001804))
* release master ([357334c](https://github.com/ptarmiganlabs/butler-sos/commit/357334ce4b7e2e1e7fc9f01f72728654773e4661))
* release master ([20d551d](https://github.com/ptarmiganlabs/butler-sos/commit/20d551d2b56c22146807056fe2c1a44c288d2375))
* release master ([430f721](https://github.com/ptarmiganlabs/butler-sos/commit/430f721a1b47207d47db5b87d5d313998b14f313))
* release master ([70e1348](https://github.com/ptarmiganlabs/butler-sos/commit/70e13484a165268498ade2a387e8f9196aab9e3e))
* release master ([1368b59](https://github.com/ptarmiganlabs/butler-sos/commit/1368b595c2c12a2af5d04f8d241e65d400a75640))
* release master ([4c9ea32](https://github.com/ptarmiganlabs/butler-sos/commit/4c9ea32fe369fefdbdab23f4c11f411e24ba4d4c))
* release master ([#233](https://github.com/ptarmiganlabs/butler-sos/issues/233)) ([bff3968](https://github.com/ptarmiganlabs/butler-sos/commit/bff3968a678ecc96c67c9f89aa88bdd44b1afcd8))
* release master ([#235](https://github.com/ptarmiganlabs/butler-sos/issues/235)) ([69ac266](https://github.com/ptarmiganlabs/butler-sos/commit/69ac2662ed38a763f79c2a4d92312a856043ce04))
* **security:** Add automatic scans for updated dependencies ([e61e28e](https://github.com/ptarmiganlabs/butler-sos/commit/e61e28ee7696743af0e05a67a2d8d10bd92f43da))
* update dependencies ([3d87f93](https://github.com/ptarmiganlabs/butler-sos/commit/3d87f930b8dbeb65fe33e667e3a0e9d45df17acd))
* update dependencies ([8c9c73c](https://github.com/ptarmiganlabs/butler-sos/commit/8c9c73c91722dcfff741eb88c4401b15d096bd89))
* Update dependencies ([caa2f5c](https://github.com/ptarmiganlabs/butler-sos/commit/caa2f5c95af30d83dc918faf72fbfba3c36a04bb))
* Update dependencies ([e71db48](https://github.com/ptarmiganlabs/butler-sos/commit/e71db488852badf11b0c96e5e1566738f8187536))
* Update dependencies ([141d288](https://github.com/ptarmiganlabs/butler-sos/commit/141d288364657e5af40c69c75f2d5a7268e0cae8))
* Update dependencies ([b9be7ed](https://github.com/ptarmiganlabs/butler-sos/commit/b9be7ed250418ec8dfc8f061976f8ae3e8177f1c))
* Update dependencies ([7b05b5a](https://github.com/ptarmiganlabs/butler-sos/commit/7b05b5a3eaede1d94801acd229522a0b1bc22939))
* Update dependencies ([0b40341](https://github.com/ptarmiganlabs/butler-sos/commit/0b4034171592abe7aa97f7212fca2832ed65b887))
* Update dependencies ([a86a8bb](https://github.com/ptarmiganlabs/butler-sos/commit/a86a8bbbc451f23626ca434c35a6ac7f85ca4bfa))
* Update dependencies ([be2d785](https://github.com/ptarmiganlabs/butler-sos/commit/be2d785948779b78131fd1ba89cdaf50c743b58b))
* update luxon dependency ([11102ba](https://github.com/ptarmiganlabs/butler-sos/commit/11102ba561f25c91c4c130ef54a9b586fe6901ee))
* update minor dependencies ([b89d155](https://github.com/ptarmiganlabs/butler-sos/commit/b89d155abf7bac4ddca06278317a3df6a97dc86f))
* Updated dependencies ([53d63fa](https://github.com/ptarmiganlabs/butler-sos/commit/53d63fa27e4a431959cad0d3cc46a746fd6a1375))
* upgrade to Fastify 4.x ([496f4ec](https://github.com/ptarmiganlabs/butler-sos/commit/496f4ec88c986d42eff344f5be9e2b65f5f6fe4a))


### Refactoring

* Align handling of user and log events ([efe0064](https://github.com/ptarmiganlabs/butler-sos/commit/efe0064b23048d71760aefc5cb4a9522145e746f))
* Apply consistent formatting to all source and doc files ([2f1634e](https://github.com/ptarmiganlabs/butler-sos/commit/2f1634ebc5bd9e3aec509a680f2a033726062e75)), closes [#419](https://github.com/ptarmiganlabs/butler-sos/issues/419)
* Change Docker healthcheck URL ([#180](https://github.com/ptarmiganlabs/butler-sos/issues/180)). ([0b99f94](https://github.com/ptarmiganlabs/butler-sos/commit/0b99f942c68fb8c3d07808d4468dd73b3905e772))
* Clean up docker-compose files ([a940f05](https://github.com/ptarmiganlabs/butler-sos/commit/a940f059f85b0f12354054bdbffea7530bec8586))
* Enfore linting + prettification ([f6efcc5](https://github.com/ptarmiganlabs/butler-sos/commit/f6efcc5e3fdc45db2fd6d740b71872a47e283d97))
* Extensive changes throughout the tool ([b0e5af3](https://github.com/ptarmiganlabs/butler-sos/commit/b0e5af3a0e8b0c899183f8acc739f01ade12c82a))
* Make proxy related log entries easier to understand ([fafe419](https://github.com/ptarmiganlabs/butler-sos/commit/fafe41980a806dbd8bffcde3d82db1436e3322b9)), closes [#392](https://github.com/ptarmiganlabs/butler-sos/issues/392)
* Make user event log messages easier to understand ([3740a2c](https://github.com/ptarmiganlabs/butler-sos/commit/3740a2ceaf8afb7aa8ce1ffcc73d5952725dbfd7)), closes [#396](https://github.com/ptarmiganlabs/butler-sos/issues/396)
* More relvant log prefixes for proxy session logging ([76ab969](https://github.com/ptarmiganlabs/butler-sos/commit/76ab969d1f8b0c1dd2a1e435f61296121ec8e7ef)), closes [#392](https://github.com/ptarmiganlabs/butler-sos/issues/392)
* Remove unnecessary handling of engine performance log messages ([f05d501](https://github.com/ptarmiganlabs/butler-sos/commit/f05d5017aa48e1950829ccf1a961379512250199)), closes [#434](https://github.com/ptarmiganlabs/butler-sos/issues/434)
* Upgrade Prometheus metrics lib to latest version ([61d363a](https://github.com/ptarmiganlabs/butler-sos/commit/61d363a80e23dd68c984a3a4eef4a82fb9a110e6))


### Documentation

* Add example using full-stack docker-compose ([119d6bb](https://github.com/ptarmiganlabs/butler-sos/commit/119d6bbc9bd3b8fb20837189bb96c1ff1e271818))
* Add Grafana 9 dashboard for Butler SOS 9.2 ([4c21567](https://github.com/ptarmiganlabs/butler-sos/commit/4c2156782b6130c4f03fe4f262f1c80540292744)), closes [#440](https://github.com/ptarmiganlabs/butler-sos/issues/440)
* Add status badge to README file ([11871c8](https://github.com/ptarmiganlabs/butler-sos/commit/11871c82aa828269ca17b3a36c692525453ecfa3))
* CI tweaking ([9107993](https://github.com/ptarmiganlabs/butler-sos/commit/9107993c912a8fdbc6cf6f06900f0cff8a168d6e))
* Clean up Markdown ([cd79b3c](https://github.com/ptarmiganlabs/butler-sos/commit/cd79b3c9aae394e787ceb224b15478c3e8198c25))
* Cleanup in-code comments ([933c65e](https://github.com/ptarmiganlabs/butler-sos/commit/933c65eee7635c558a11de5edcd3cf9722f378e4))
* Keep old changelog as separate file ([ba95a74](https://github.com/ptarmiganlabs/butler-sos/commit/ba95a7417e92773e0bcda307120f1512c238e26d))
* Tweak docker-compose sample files ([3c6adb4](https://github.com/ptarmiganlabs/butler-sos/commit/3c6adb4b21a60c192a79806a9b6ba62916a584a3))
* Update Dockerfiles ([e891ad9](https://github.com/ptarmiganlabs/butler-sos/commit/e891ad97108933b462f8625b10dd7af1cf3f500d))
* update readme file ([44e7e9c](https://github.com/ptarmiganlabs/butler-sos/commit/44e7e9c984f6fe6c1bf1f4d6bc582a90d1653d78))
* Updated year in LICENSE file ([970f139](https://github.com/ptarmiganlabs/butler-sos/commit/970f139c3fd83c58c3ef1daea1bd0287719436ec))

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
