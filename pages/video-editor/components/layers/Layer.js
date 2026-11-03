
/**
 * External dependencies
 */
import { useDispatch } from 'react-redux';
import { store as layersStore } from '@godam/layers';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Suspense } from '@wordpress/element';
import { useSelect } from '@wordpress/data';

/**
 * Internal dependencies
 */
import LayerErrorBoundary from './LayerErrorBoundary';
import UnregisteredLayerNotice from './UnregisteredLayerNotice';
import { LayerContext } from '../../layers/hooks';
import { getLegacyEditComponent } from '../../layers/legacy';
import { removeLayer } from '../../redux/slice/videoSlice';

/**
 * The settings panel for the selected layer: its type's `edit` component from
 * the layer registry. A panel an add-on names through the old
 * `godam_video_editor_layer_components` hook still takes precedence. A layer
 * whose type isn't registered gets a notice instead (RFC D2).
 *
 * @param {Object}   param0          - Props for the Layer component.
 * @param {Object}   param0.layer    - The layer data containing type and associated metadata.
 * @param {Function} param0.goBack   - Callback to navigate back to the previous step.
 * @param {number}   param0.duration - Duration of the video in seconds or milliseconds.
 *
 * @return {JSX.Element} The rendered Layer component.
 */
const Layer = ( { layer, goBack, duration } ) => {
	const dispatch = useDispatch();
	const layerType = useSelect( ( select ) => select( layersStore ).getLayerType( layer?.type ), [ layer?.type ] );
	const Edit = getLegacyEditComponent( layer?.type ) ?? layerType?.edit;

	const handleDelete = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack?.();
	};

	// The boundary wraps every return path so no layer editor — core or add-on —
	// can throw and white-screen the whole editor.
	return (
		<LayerErrorBoundary resetKey={ layer.id } goBack={ goBack }>
			<LayerContext.Provider value={ layer.id }>
				<Suspense fallback={ <div>{ __( 'Loading layer…', 'godam' ) }</div> }>
					{ Edit
						? <Edit layerID={ layer.id } goBack={ goBack } duration={ duration } />
						: <UnregisteredLayerNotice layer={ layer } goBack={ goBack } onDelete={ handleDelete } /> }
				</Suspense>
			</LayerContext.Provider>
		</LayerErrorBoundary>
	);
};

/**
 * Export default `Layer` component.
 */
export default Layer;
