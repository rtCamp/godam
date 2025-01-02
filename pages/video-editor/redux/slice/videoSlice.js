// src/slices/todosSlice.js
/**
 * External dependencies
 */
import { createSlice } from '@reduxjs/toolkit';

const slice = createSlice( {
	name: 'video',
	initialState: {
		videoConfig: {
			controls: true,
			fluid: true,
			preload: 'auto',
			width: '100%',
			sources: [],
			playbackRates: [ 0.5, 1, 1.5, 2 ],
			captions: [
				{
					kind: 'captions',
					src: 'https://dotsub.com/media/5d5f008c-b5d5-466f-bb83-2b3cfa997992/c/chi_hans/vtt',
					srclang: 'zh',
					label: 'Chinese',
					default: true,
				},
				{
					kind: 'captions',
					src: 'https://example.com/captions-en.vtt',
					srclang: 'en',
					label: 'English',
				},
			],
			controlBar: {
				playToggle: true, // Play/Pause button
				volumePanel: true,
				currentTimeDisplay: true, // Current time
				timeDivider: true, // Divider between current time and duration
				durationDisplay: true, // Total duration
				fullscreenToggle: true, // Full-screen button
				subsCapsButton: true,
				skipButtons: {
					forward: 10,
					backward: 10,
				},
				progressControl: {
					vertical: true, // Prevent horizontal volume slider
				},
				//custom controls
				brandingIcon: false,
				appearanceColor: '',
				hoverColor: '',
				zoomLevel: 0,
				playButtonPosition: 'center',
				controlBarPosition: 'horizontal',
				customBrandImg: '',
				customPlayBtnImg: '',
			},
		},
		layers: [],
		isChanged: false,
		currentLayer: null,
	},
	reducers: {
		initializeStore: ( state, action ) => {
			const { videoConfig, layers, skipTime } = action.payload;
			state.videoConfig = {
				...state.videoConfig,
				...videoConfig,
				controlBar: {
					...state.videoConfig.controlBar,
					...videoConfig.controlBar, // Nested merge for controlBar
				},
			};
			state.layers = layers;
			state.isChanged = false;
			state.skipTime = skipTime;
		},
		saveVideoMeta: ( state, action ) => {
			state.isChanged = false;
		},
		addLayer: ( state, action ) => {
			const newLayer = action.payload;
			state.layers.push( newLayer );
			state.currentLayer = newLayer;
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
		updateVideoConfig: ( state, action ) => {
			state.videoConfig = { ...state.videoConfig, ...action.payload };
			state.isChanged = true;
		},
		updateSkipTime: ( state, action ) => {
			state.skipTime = action.payload.selectedSkipVal;
			state.isChanged = true;
		},
		setCurrentLayer: ( state, action ) => {
			state.currentLayer = action.payload;
		},
	},
} );

export const {
	initializeStore, saveVideoMeta,
	addLayer,
	removeLayer,
	updateLayerField,
	updateVideoConfig,
	updateSkipTime,
	setCurrentLayer,
} = slice.actions;
export default slice.reducer;
