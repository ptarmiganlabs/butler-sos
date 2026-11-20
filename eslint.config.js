import prettier from 'eslint-plugin-prettier';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import jsdoc from 'eslint-plugin-jsdoc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

// The extension-point boundary. Core reaches src/lib/extensions/ only through the `#extensions`
// specifier, and through apply.js and version.js, which are core-side code that lives beside the
// seam rather than behind it.
const SEAM_MESSAGE =
    'Import the extension point through the `#extensions` specifier instead. A relative path resolves under node and Jest, so it passes every test, and then silently ignores the build-time override - esbuild cannot alias a relative specifier. The failure appears only inside the packaged binary. Nothing under src/lib/extensions/ is reachable from core except `#extensions`, and apply.js and version.js beside it.';

/**
 * The extension-point boundary, as no-restricted-imports patterns.
 *
 * `**\/extensions/index.js` catches the module being imported by path rather than through the
 * specifier. `**\/extensions/*\/**` catches anything reaching into a subdirectory of it.
 *
 * These patterns match the import *string*, not the resolved path, so they are deliberately not
 * anchored on `lib/extensions/`: a sibling module writes `../extensions/index.js`, with no `lib/` in
 * it. The accepted cost is that a future directory named `extensions` anywhere under `src/` inherits
 * this rule. There is none today; if one appears, rename it or scope this block by `files`.
 */
const SEAM_IMPORT_PATTERNS = [
    {
        group: ['**/extensions/index.js', '**/extensions/*/**'],
        message: SEAM_MESSAGE,
    },
];

/**
 * The dynamic-import half of the same boundary: no-restricted-imports covers static imports and
 * `export ... from` only, and a dynamic `await import('./extensions/index.js')` sails past it.
 */
const SEAM_IMPORT_SELECTOR = {
    selector: 'ImportExpression > Literal[value=/extensions\\/(index\\.js|[^/]+\\/)/]',
    message: SEAM_MESSAGE,
};

// export default [...compat.extends("airbnb-base", "prettier"), {
export default [
    {
        ignores: ['**/jsontree.js', '**/prism.js'], // Exclude from linting
    },
    ...compat.extends('prettier'),
    jsdoc.configs['flat/recommended'],
    {
        plugins: {
            prettier,
            jsdoc,
        },

        languageOptions: {
            globals: {
                ...globals.node,
                // Defined by scripts/bundle.mjs when it bundles, and absent in a source run.
                // src/lib/util/version-report.js reads both behind a `typeof` guard.
                __BUTLER_SOS_BUILD_DATE__: 'readonly',
                __BUTLER_SOS_EXTENSIONS_VERSION__: 'readonly',
            },

            ecmaVersion: 2022,
            sourceType: 'module',
        },

        rules: {
            'prettier/prettier': 'error',
            // JSDoc related rules
            // 'jsdoc/tag-lines': 1,
            'jsdoc/tag-lines': ['error', 'any', { startLines: 1 }],
            'jsdoc/require-jsdoc': [
                'error',
                {
                    require: {
                        FunctionDeclaration: true,
                        MethodDefinition: true,
                        ClassDeclaration: true,
                        ArrowFunctionExpression: true,
                        FunctionExpression: true,
                    },
                },
            ],
            'jsdoc/require-description': 'error',
            'jsdoc/require-param': 'error',
            'jsdoc/require-param-description': 'error',
            'jsdoc/require-param-name': 'error',
            'jsdoc/require-param-type': 'error',
            'jsdoc/require-returns': 'error',
            'jsdoc/require-returns-description': 'error',
            'jsdoc/require-returns-type': 'error',
        },
    },
    {
        // Test files document themselves through their test names. Requiring JSDoc on the
        // inline arrow functions used for mocks and stubs produces noise, not documentation,
        // and the autofixer's response is to insert empty comment blocks that are themselves
        // lint errors. Everything else — including all JSDoc correctness rules — still applies.
        files: ['**/__tests__/**/*.js', '**/*.test.js'],
        rules: {
            'jsdoc/require-jsdoc': 'off',
        },
    },
    {
        // Placed last, carrying `files` and `rules` only. If another block ever needs
        // no-restricted-imports or no-restricted-syntax for these files, add its patterns here
        // instead: flat config replaces a rule's options rather than merging them, so a second
        // block naming the same rule would silently switch this one off.
        files: ['src/**/*.js'],
        ignores: ['src/lib/extensions/**'],
        rules: {
            'no-restricted-imports': ['error', { patterns: SEAM_IMPORT_PATTERNS }],
            'no-restricted-syntax': ['error', SEAM_IMPORT_SELECTOR],
        },
    },
];
