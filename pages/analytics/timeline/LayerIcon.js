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
import './layer-icon.scss';

/**
 * Layer-type icon renderer.
 *
 * `getLayerIcon` returns one of two shapes:
 * `{ kind: 'wp', icon: <@wordpress/icons descriptor> }` — render via
 * the `<Icon>` component, wrapped in a span that forces both `color`
 * and SVG `fill` so the glyph reliably picks up the requested tint
 * (the default `currentColor` cascade isn't honored by every WordPress
 * icon SVG — some hardcode their fill).
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
 * @param {string} [props.color]   Override color for `kind: 'wp'` glyphs. URL-based icons ignore this.
 * @return {JSX.Element|null} The icon element, or null when no icon is available.
 */
const LayerIcon = ( { layerType, size = 18, alt, color } ) => {
	const descriptor = getLayerIcon( layerType );
	if ( ! descriptor ) {
		return null;
	}
	if ( descriptor.kind === 'wp' ) {
		// Force both `color` (for paths that use currentColor) and `fill`
		// (for paths with a hardcoded fill). Inline-flex so the SVG sits
		// flush with surrounding text.
		const tint = color || 'currentColor';
		return (
			<span
				className="godam-layer-icon"
				style={ {
					display: 'inline-flex',
					alignItems: 'center',
					justifyContent: 'center',
					color: tint,
					fill: tint,
				} }
			>
				<Icon icon={ descriptor.icon } size={ size } />
			</span>
		);
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
