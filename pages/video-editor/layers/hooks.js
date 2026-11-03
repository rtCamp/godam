/**
 * Hooks for layer settings panels, core and add-on alike. Exposed to add-ons
 * on `window.godam.layerEditor`, so they never import react-redux or read the
 * editor's store shape.
 */

/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { createContext, useCallback, useContext } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../redux/slice/videoSlice';

const MANAGED_KEYS = [ 'id', 'type' ];

/**
 * The id of the layer whose settings panel is open.
 */
export const LayerContext = createContext( null );

/**
 * The layer whose settings panel is open, or the one with this id.
 *
 * @param {string} [layerId] Layer id; defaults to the open layer.
 * @return {Object|undefined} The layer.
 */
export function useLayer( layerId ) {
	const contextId = useContext( LayerContext );
	const id = layerId ?? contextId;
	return useSelector( ( state ) => state.videoReducer.layers.find( ( layer ) => layer.id === id ) );
}

/**
 * The open layer and a setter that merges attribute changes into it.
 *
 * @param {string} [layerId] Layer id; defaults to the open layer.
 * @return {Array} `[ layer, setAttributes( changes ) ]`.
 */
export function useLayerAttributes( layerId ) {
	const layer = useLayer( layerId );
	const dispatch = useDispatch();
	const id = layer?.id;

	const setAttributes = useCallback( ( changes ) => {
		if ( ! id || ! changes ) {
			return;
		}
		Object.entries( changes ).forEach( ( [ field, value ] ) => {
			if ( ! MANAGED_KEYS.includes( field ) ) {
				dispatch( updateLayerField( { id, field, value } ) );
			}
		} );
	}, [ dispatch, id ] );

	return [ layer, setAttributes ];
}
