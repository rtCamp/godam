/**
 * External dependencies
 */
import React from 'react';

/**
 * WordPress dependencies
 */
import { Icon } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { getLayerIcon } from '../constants/layerTypes';

/**
 * Layer-type icon renderer.
 *
 * `getLayerIcon` returns one of two shapes:
 * `{ kind: 'wp', icon: <@wordpress/icons descriptor> }` — render via
 * the `<Icon>` component. Inherits parent text color via currentColor,
 * so a marker with `color: '#fff'` shows a white glyph.
 * `{ kind: 'url', url: '...' }` — render via `<img>`. The asset's
 * baked-in colors are preserved (matches the editor seekbar's
 * handling for add-on layer icons like the Woo logo).
 *
 * Falls back to nothing if the layer type isn't known to either path —
 * the parent component still renders, just without an icon.
 *
 * @param {Object} props
 * @param {string} props.layerType Layer type id ('cta' / 'form' / 'hotspot' / 'poll' / 'woo' / …).
 * @param {number} [props.size]    Pixel size for both Icon glyph and img height. Defaults to 18.
 * @param {string} [props.alt]     Alt text for URL-based icons.
 * @return {JSX.Element|null} The icon element, or null when no icon is available.
 */
const LayerIcon = ( { layerType, size = 18, alt } ) => {
	const descriptor = getLayerIcon( layerType );
	if ( ! descriptor ) {
		return null;
	}
	if ( descriptor.kind === 'wp' ) {
		return <Icon icon={ descriptor.icon } size={ size } />;
	}
	if ( descriptor.kind === 'url' && descriptor.url ) {
		return (
			<img
				src={ descriptor.url }
				alt={ alt || '' }
				width={ size }
				height={ size }
				style={ {
					width: size,
					height: size,
					objectFit: 'contain',
					display: 'block',
				} }
			/>
		);
	}
	return null;
};

export default LayerIcon;
