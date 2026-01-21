
/**
 * WordPress dependencies
 */
import { applyFilters, addFilter } from '@wordpress/hooks';

/**
 * Internal dependencies
 */
import FormLayer from './FormLayer';
import CTALayer from './CTALayer';
import HotspotLayer from './HotspotLayer';
import Ads from './AdsLayer';
import PollLayer from './PollLayer';

/**
 * Core Layer Components.
 * Additional layer types can be registered via the 'godam.videoEditor.layerComponents' filter.
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
 * Get all registered layer components (core + filtered).
 *
 * @return {Object} Object containing all registered layer components.
 */
const getLayerComponents = () => {
	return applyFilters( 'godam.videoEditor.layerComponents', coreLayerComponents );
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
	const Component = LayerComponents[ layerType ]?.component;
	console.log( 'Layer is init' );
	console.log( LayerComponents );

	// Fallback to CTA layer if component is not found
	if ( ! Component ) {
		const FallbackComponent = LayerComponents[ 'cta' ]?.component;
		if ( ! FallbackComponent ) {
			return <div>Error: No layer components registered</div>;
		}
		return <FallbackComponent layerID={ layer.id } goBack={ goBack } duration={ duration } />;
	}

	return <Component layerID={ layer.id } goBack={ goBack } duration={ duration } />;
};

/**
 * Export default `Layer` component.
 */
export default Layer;
