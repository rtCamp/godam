
/**
 * Internal dependencies
 */
/**
 * WordPress dependencies
 */
import FormLayer from './FormLayer';
import CTALayer from './CTALayer';
import HotspotLayer from './HotspotLayer';

const Layer = ( { layer, goBack } ) => {
	return (
		<>
			{
				layer.type === 'form' && <FormLayer layerID={ layer.id } goBack={ goBack } />
			}
			{
				layer.type === 'cta' && <CTALayer layerID={ layer.id } goBack={ goBack } />
			}
			{
				layer.type === 'hotspot' && <HotspotLayer layerID={ layer.id } goBack={ goBack } />
			}
		</>
	);
};

export default Layer;
