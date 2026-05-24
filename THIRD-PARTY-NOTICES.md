# Third-Party Notices

Butler SOS includes the following third-party packages that require notice beyond the project license.

License review note: user-agent parsing uses `bowser` (MIT) rather than `ua-parser-js` v2 so runtime builds avoid introducing an AGPL dependency. If user-agent parsing dependencies are updated in the future, re-run `npm run license:check` and review the replacement license before allow-listing it.

## lru-cache

- Package: `lru-cache`
- Version: 11.3.6
- License: BlueOak-1.0.0
- Package URL: https://www.npmjs.com/package/lru-cache
- Source URL: https://github.com/isaacs/node-lru-cache
- License text: https://blueoakcouncil.org/license/1.0.0
