/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { setCurrentLayer } from '../../redux/slice/videoSlice';
import Layer from '../layers/Layer';

/**
 * Right-hand configuration panel for the Layers tab.
 *
 * Shows the selected layer's editor (the existing `<Layer>` router, unchanged)
 * or an empty state when nothing is selected. Driven entirely by the existing
 * `currentLayer` state — no new state is introduced.
 *
 * @param {Object} props
 * @param {number} props.duration Video duration in seconds, forwarded to `<Layer>`.
 * @return {JSX.Element} The configuration panel.
 */
const ConfigurationPanel = ( { duration } ) => {
	const dispatch = useDispatch();
	const currentLayer = useSelector( ( state ) => state.videoReducer.currentLayer );

	if ( ! currentLayer ) {
		return (
			<>
				<div className="godam-video-editor__config-header">
					<p className="godam-video-editor__config-title">{ __( 'Configuration Panel', 'godam' ) }</p>
					<p className="godam-video-editor__config-subtitle">{ __( 'Selected layer will be displayed here', 'godam' ) }</p>
				</div>
				<div className="godam-video-editor__config-empty">
					<p className="godam-video-editor__config-empty-title">{ __( 'No layers selected', 'godam' ) }</p>
					<p className="godam-video-editor__config-empty-text">{ __( 'Select a layer from the left panel to edit its properties', 'godam' ) }</p>
				</div>
			</>
		);
	}

	return (
		<Layer
			layer={ currentLayer }
			goBack={ () => dispatch( setCurrentLayer( null ) ) }
			duration={ duration }
		/>
	);
};

export default ConfigurationPanel;
