/**
 * The `godam/layers` data store: every registered layer type, in registration order.
 */

/**
 * WordPress dependencies
 */
import { createReduxStore, createSelector, register } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { STORE_NAME } from './constants';

const DEFAULT_STATE = {
	types: {},
	order: [],
};

const reducer = ( state = DEFAULT_STATE, action ) => {
	switch ( action.type ) {
		case 'ADD_LAYER_TYPE':
			return {
				types: { ...state.types, [ action.layerType.name ]: action.layerType },
				order: state.order.includes( action.layerType.name ) ? state.order : [ ...state.order, action.layerType.name ],
			};
		case 'REMOVE_LAYER_TYPE': {
			if ( ! state.types[ action.name ] ) {
				return state;
			}
			const { [ action.name ]: removed, ...types } = state.types; // eslint-disable-line no-unused-vars
			return {
				types,
				order: state.order.filter( ( name ) => name !== action.name ),
			};
		}
		default:
			return state;
	}
};

const actions = {
	addLayerType: ( layerType ) => ( { type: 'ADD_LAYER_TYPE', layerType } ),
	removeLayerType: ( name ) => ( { type: 'REMOVE_LAYER_TYPE', name } ),
};

const selectors = {
	getLayerType: ( state, name ) => state.types[ name ],
	getLayerTypes: createSelector(
		( state ) => state.order.map( ( name ) => state.types[ name ] ),
		( state ) => [ state.types, state.order ],
	),
};

export const store = createReduxStore( STORE_NAME, { reducer, actions, selectors } );

register( store );
