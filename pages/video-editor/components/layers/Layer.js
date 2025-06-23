
/**
 * Internal dependencies
 */
/**
 * WordPress dependencies
 */
import FormLayer from './FormLayer';
import CTALayer from './CTALayer';
import HotspotLayer from './HotspotLayer';
import Ads from './AdsLayer';
import PollLayer from './PollLayer';

const Layer = ( { layer, goBack, duration } ) => {
	return (
		<>
			{
				layer.type === 'form' && <FormLayer __nextHasNoMarginBottom={ true } layerID={ layer.id } goBack={ goBack } duration={ duration } />
			}
			{
				layer.type === 'cta' && <CTALayer layerID={ layer.id } goBack={ goBack }duration={ duration } />
			}
			{
				layer.type === 'hotspot' && <HotspotLayer layerID={ layer.id } goBack={ goBack } duration={ duration } />
			}
			{
				layer.type === 'ad' && <Ads layerID={ layer.id } goBack={ goBack }duration={ duration } />
			}
			{
				layer.type === 'poll' && <PollLayer layerID={ layer.id } goBack={ goBack } duration={ duration } />
			}
		</>
	);
};

export default Layer;
