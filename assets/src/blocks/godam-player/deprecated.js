/**
 * Internal dependencies
 */
import metadata from './block.json';
import save from './save';

/**
 * Supports before the border moved from the block wrapper to the video.
 *
 * Until n.e.x.t the border was serialized on the wrapper, so a saved post with a
 * border carries it in the wrapper's `style` and class. Same attributes and
 * save, only the border is serialized again, so those posts still validate.
 * The border then renders on the video like a new block's.
 */
const { __experimentalSkipSerialization: skipSerialization, ...wrapperBorder } = metadata.supports.__experimentalBorder; // eslint-disable-line no-unused-vars

const v1 = {
	attributes: metadata.attributes,
	supports: {
		...metadata.supports,
		__experimentalBorder: wrapperBorder,
	},
	save,
};

export default [ v1 ];
