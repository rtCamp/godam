/**
 * Bridge from the pre-Layer-API add-on hooks to the layer registry.
 *
 * Add-ons such as godam-for-woo still describe their layer through three old
 * hooks: `godam_video_editor_layer_options` (the menu entry, localized as
 * `godamVideoEditorConfig.layerOptions`); `godam_video_editor_layer_components`
 * (the settings panel, naming a component on `window.godamLayerComponents`);
 * and `window.godamLayerCreators[ type ]` (the data for a new layer).
 *
 * This registers those types so the editor only reads the registry. The
 * component and creator are looked up when used, because add-on scripts can
 * load after the editor. #2296 moves godam-for-woo onto the Layer API and
 * turns these into deprecated shims; the `woo` entries below go with it.
 */

/**
 * External dependencies
 */
import { getLayerType, __unstableRegisterLegacyLayerType, __unstableDeprecated as deprecated } from '@godam/layers';

/**
 * Shopping-cart glyph (white line art) for commerce layer markers.
 * `@wordpress/icons` ships no cart icon, so it's defined inline here.
 *
 * @return {JSX.Element} Cart SVG.
 */
const CartIcon = () => (
	<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<circle cx="9" cy="20" r="1.5" />
		<circle cx="18" cy="20" r="1.5" />
		<path d="M2 3h3l2.4 12a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L22 7H6" />
	</svg>
);

// What core used to hard-code for the Woo layer; it can't say so through the old hooks.
const LEGACY_WOO = {
	color: '#873eff',
	markerIcon: CartIcon,
	supports: { media: [ 'video', 'image' ] },
};

/**
 * The settings panel an add-on named through `godam_video_editor_layer_components`,
 * if its script has put it on `window.godamLayerComponents`. Also lets an add-on
 * replace a core type's panel, as it always could.
 *
 * @param {string} type Layer type name.
 * @return {Function|undefined} The add-on's settings component.
 */
export function getLegacyEditComponent( type ) {
	const componentName = window.godamVideoEditorConfig?.layerComponents?.[ type ];
	const component = componentName ? window.godamLayerComponents?.[ componentName ] : undefined;
	if ( component ) {
		deprecated( 'window.godamLayerComponents', 'the `edit` setting of registerLayerType()' );
	}
	return component;
}

/**
 * Register every layer type an add-on described through the old hooks.
 */
export function registerLegacyLayerTypes() {
	( window.godamVideoEditorConfig?.layerOptions || [] ).forEach( ( option ) => {
		const name = option?.type;
		if ( ! name || getLayerType( name ) ) {
			return;
		}

		__unstableRegisterLegacyLayerType( {
			name,
			title: option.title || option.layerText || name,
			label: option.layerText || option.title,
			description: option.title && option.layerText ? option.layerText : '',
			icon: option.iconUrl ? undefined : option.icon,
			iconUrl: option.iconUrl,
			...( 'woo' === name ? LEGACY_WOO : {} ),
			getAvailability: () => (
				false === option.isActive
					? { available: false, reason: option.tooltipMessage ?? '' }
					: null
			),
			create: ( context ) => {
				const creator = window.godamLayerCreators?.[ name ];
				if ( ! creator ) {
					return undefined;
				}
				deprecated( 'window.godamLayerCreators', 'the `create` setting of registerLayerType()' );
				return creator( context );
			},
		} );
	} );
}
