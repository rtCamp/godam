// src/slices/todosSlice.js
/**
 * External dependencies
 */
import { createSlice } from '@reduxjs/toolkit';

const slice = createSlice( {
	name: 'video',
	initialState: {
		videoConfig: {
			playButton: true,
			volumeButton: true,
			fullscreenButton: true,
			qualityButton: 'auto',
		},
		layers: [],
		isChanged: false,
	},
	reducers: {
		initializeStore: ( state, action ) => {
			const {
				videoConfig,
				layers,
			} = action.payload;

			state.videoConfig = videoConfig;
			state.layers = layers;
			state.isChanged = false;
		},
		addLayer: ( state, action ) => {
			const newLayer = action.payload;
			state.layers.push( newLayer );
			state.isChanged = true;
		},
		removeLayer: ( state, action ) => {
			const layerId = action.payload.id;
			state.layers = state.layers.filter( ( layer ) => layer.id !== layerId );
			state.isChanged = true;
		},
		updateLayerField: ( state, action ) => {
			const { id, field, value } = action.payload;
			const ind = state.layers.findIndex( ( l ) => l.id === id );
			state.layers[ ind ][ field ] = value;
			state.isChanged = true;
		},
	},
} );

export const { initializeStore, addLayer, removeLayer, updateLayerField } = slice.actions;
export default slice.reducer;
