/**
 * The version of the extension contract that this source tree implements.
 *
 * Bumped only by a change that an existing description could not survive: a renamed property, a
 * changed signature, a property becoming required, or a hook core already calls gaining a new call
 * site. Adding an optional hook or an optional property costs nothing, because core ignores what it
 * does not recognise.
 */
export const SEAM_VERSION = 1;

/**
 * Fail a build whose extensions module targets a different contract version.
 *
 * Build time is the only place this check belongs. The two halves of a variant build are always
 * built together, so a mismatch is a property of the build rather than of the machine the binary
 * later runs on - and with no override set the committed default matches by construction, so a
 * runtime assert would sit in every shipped binary guarding a condition that cannot occur there.
 *
 * Exported from here rather than written inline in `scripts/bundle.mjs` so that the comparison is
 * covered by the test suite.
 *
 * @param {object} description - The description exported by the extensions module being bundled.
 * @param {string} source - Where that module came from, for the error message.
 *
 * @returns {void} Nothing. Returns normally when the versions agree.
 *
 * @throws {Error} When the description targets a version other than {@link SEAM_VERSION}, so the
 *     build stops before esbuild runs rather than producing a binary that misreads its own
 *     extensions.
 */
export const assertSeamVersion = (description, source) => {
    const targeted = description?.seamVersion;

    if (targeted !== SEAM_VERSION) {
        throw new Error(
            `Extension contract mismatch: ${source} targets seamVersion ${targeted}, this source tree implements ${SEAM_VERSION}. Build both halves from matching revisions.`
        );
    }
};
