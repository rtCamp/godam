/**
 * Deprecations for the GoDAM Audio block.
 */

/**
 * Internal dependencies
 */
import metadata from './block.json';

/**
 * v1 → current: the `caption` attribute was removed (the Transcript tab replaces
 * it). The block is dynamic (`save()` returns null), so existing blocks stay
 * valid and `migrate` would never run on its own — `isEligible` forces the
 * migration for any block that still carries a non-empty `caption`, folding it
 * into `description` (kept only if `description` is empty). The value also
 * survives in `post_content`, so nothing is lost either way.
 *
 * @type {Object}
 */
const v1 = {
	attributes: {
		...metadata.attributes,
		caption: {
			type: 'string',
			default: '',
		},
	},
	supports: metadata.supports,
	save: () => null,
	isEligible: ( attributes ) => Boolean( attributes.caption ),
	migrate: ( attributes ) => {
		const { caption, ...rest } = attributes;
		return {
			...rest,
			description: rest.description || caption,
		};
	},
};

export default [ v1 ];
