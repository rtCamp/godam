
/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Suspense } from '@wordpress/element';

/**
 * Internal dependencies
 */
import FormLayer from './FormLayer';
import CTALayer from './CTALayer';
import HotspotLayer from './HotspotLayer';
import Ads from './AdsLayer';
import PollLayer from './PollLayer';
import LayerErrorBoundary from './LayerErrorBoundary';

/**
 * Core Layer Components.
 * Additional layer types can be registered via PHP filters.
 */
const coreLayerComponents = {
	form: {
		component: FormLayer,
	},
	cta: {
		component: CTALayer,
	},
	hotspot: {
		component: HotspotLayer,
	},
	ad: {
		component: Ads,
	},
	poll: {
		component: PollLayer,
	},
};

/**
 * Get all registered layer components (core + PHP filtered).
 * PHP filtered components are loaded from window.godamVideoEditorConfig and
 * their actual components are loaded from window.godamLayerComponents.
 *
 * @return {Object} Object containing all registered layer components.
 */
const getLayerComponents = () => {
	const components = { ...coreLayerComponents };

	// Merge with PHP-filtered components (e.g., WooCommerce)
	const phpComponents = window.godamVideoEditorConfig?.layerComponents || {};
	const loadedComponents = window.godamLayerComponents || {};

	Object.keys( phpComponents ).forEach( ( key ) => {
		const componentName = phpComponents[ key ];
		if ( loadedComponents[ componentName ] ) {
			components[ key ] = {
				component: loadedComponents[ componentName ],
			};
		}
	} );

	return components;
};

/**
 * Component to add the layer based on the type.
 *
 * @param {Object}   param0          - Props for the Layer component.
 * @param {Object}   param0.layer    - The layer data containing type and associated metadata.
 * @param {Function} param0.goBack   - Callback to navigate back to the previous step.
 * @param {number}   param0.duration - Duration of the video in seconds or milliseconds.
 *
 * @return {JSX.Element} The rendered Layer component.
 */
const Layer = ( { layer, goBack, duration } ) => {
	const LayerComponents = getLayerComponents();
	const layerType = layer?.type ?? 'cta';
	// Fall back to the CTA layer when the requested type has no registered component.
	const Component = LayerComponents[ layerType ]?.component ?? LayerComponents.cta?.component;

	// The boundary wraps every return path (including the fallback) so no layer
	// editor — core or add-on — can throw and white-screen the whole editor.
	return (
		<LayerErrorBoundary resetKey={ layer.id } goBack={ goBack }>
			<Suspense fallback={ <div>{ __( 'Loading layer…', 'godam' ) }</div> }>
				{ Component ? (
					<Component layerID={ layer.id } goBack={ goBack } duration={ duration } />
				) : (
					<div>{ __( 'Error: No layer components registered', 'godam' ) }</div>
				) }
			</Suspense>
		</LayerErrorBoundary>
	);
};

/**
 * Export default `Layer` component.
 */
export default Layer;
