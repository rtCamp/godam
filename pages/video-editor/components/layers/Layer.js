
/**
 * Internal dependencies
 */
import FormLayer from './FormLayer';
import CTALayer from './CTALayer';
import HotspotLayer from './HotspotLayer';
import Ads from './AdsLayer';
import PollLayer from './PollLayer';
import WoocommerceLayer from './WoocommerceLayer';

/**
 * Layer Component that needs to be used.
 */
const LayerComponents = {
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
	woo: {
		component: WoocommerceLayer,
	},
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
	const Component = LayerComponents[ layer?.type ?? 'cta' ]?.component;

	return <Component layerID={ layer.id } goBack={ goBack } duration={ duration } />;
};

/**
 * Export default `Layer` component.
 */
export default Layer;
