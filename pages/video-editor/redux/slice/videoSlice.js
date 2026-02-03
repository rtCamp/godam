/* global godamSettings */

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
			captions: [],
			adServer: 'self-hosted',
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
				//custom controls
				brandingIcon: true,
				appearanceColor: godamSettings?.brandColor ? godamSettings?.brandColor : '#2b333fb3',
				hoverColor: '#fff',
				zoomLevel: 0,
				playButtonPosition: 'center',
				controlBarPosition: 'horizontal',
				customBrandImg: '',
				customPlayBtnImg: '',
			},
		},
		layers: [],
		chapters: [],
		isChanged: false,
		currentLayer: null,
		currentTab: 'layers',
		loading: false,
		gforms: [],
		cf7Forms: [],
		fluentForms: [],
		wpforms: [],
		gformPluginActive: true,
		jetpackForms: [],
		jetpackPluginActive: false,
		sureforms: [],
		sureformsPlugnActive: false,
		forminatorForms: [],
		forminatorPluginActive: false,
		metforms: [],
		metformPlugnActive: false,
	},
	reducers: {
		initializeStore: ( state, action ) => {
			const { videoConfig, layers, skipTime, chapters } = action.payload;
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
			state.chapters = chapters || [];
		},
		saveVideoMeta: ( state ) => {
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
			if ( ind !== -1 ) {
				state.layers[ ind ][ field ] = value;
			}
			if ( state.currentLayer?.id === id ) {
				state.currentLayer = { ...state.currentLayer, [ field ]: value };
			}
			state.isChanged = true;
		},
		addChapter: ( state, action ) => {
			const newChapter = action.payload;
			state.chapters.push( newChapter );
			state.currentChapter = newChapter;
			state.isChanged = true;
		},
		removeChapter: ( state, action ) => {
			const chapterID = action.payload.id;
			state.chapters = state.chapters.filter( ( layer ) => layer.id !== chapterID );
			state.isChanged = true;
		},
		updateChapterField: ( state, action ) => {
			const { id, field, value } = action.payload;
			const ind = state.chapters.findIndex( ( l ) => l.id === id );
			state.chapters[ ind ][ field ] = value;
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
		setCurrentTab: ( state, action ) => {
			// check if action.payload is either 'layers' or 'player-settings'.
			if ( action.payload === 'layers' || action.payload === 'player-settings' || action.payload === 'chapters' ) {
				state.currentTab = action.payload;
			}
		},
		setLoading: ( state, action ) => {
			state.loading = action.payload;
		},
		setGravityForms: ( state, action ) => {
			state.gforms = action.payload;
		},
		setGravityFormsPluginActive: ( state, action ) => {
			state.gformPluginActive = action.payload;
		},
		setCF7Forms: ( state, action ) => {
			state.cf7Forms = action.payload;
		},
		SetCF7PluginActive: ( state, action ) => {
			state.cf7PluginActive = action.payload;
		},
		setWPForms: ( state, action ) => {
			state.wpforms = action.payload;
		},
		setEverestForms: ( state, action ) => {
			state.everestForms = action.payload;
		},
		setWPFormPluginActive: ( state, action ) => {
			state.wpFormPluginActive = action.payload;
		},
		setJetpackForms: ( state, action ) => {
			state.jetpackForms = action.payload;
		},
		setFluentForms: ( state, action ) => {
			state.fluentForms = action.payload;
		},
		setJetpackPluginActive: ( state, action ) => {
			state.jetpackPluginActive = action.payload;
		},
		setSureforms: ( state, action ) => {
			state.sureforms = action.payload;
		},
		setSureformsPluginActive: ( state, action ) => {
			state.sureformsPlugnActive = action.payload;
		},
		setForminatorForms: ( state, action ) => {
			state.forminatorForms = action.payload;
		},
		setForminatorPluginActive: ( state, action ) => {
			state.forminatorPluginActive = action.payload;
		},
		setNinjaForms: ( state, action ) => {
			state.ninjaForms = action.payload;
		},
		setNinjaPluginActive: ( state, action ) => {
			state.ninjaPluginActive = action.payload;
		},
		setMetforms: ( state, action ) => {
			state.metforms = action.payload;
		},
		setMetformPluginActive: ( state, action ) => {
			state.metformPlugnActive = action.payload;
		},
	},
} );

export const {
	initializeStore, saveVideoMeta,
	addLayer,
	removeLayer,
	updateLayerField,
	addChapter,
	removeChapter,
	updateChapterField,
	updateVideoConfig,
	updateSkipTime,
	setCurrentLayer,
	setCurrentTab,
	setLoading,
	setGravityForms,
	setGravityFormsPluginActive,
	setCF7Forms,
	SetCF7PluginActive,
	setWPForms,
	setEverestForms,
	setWPFormPluginActive,
	setJetpackForms,
	setFluentForms,
	setJetpackPluginActive,
	setSureforms,
	setSureformsPluginActive,
	setForminatorForms,
	setForminatorPluginActive,
	setNinjaForms,
	setNinjaPluginActive,
	setMetforms,
	setMetformPluginActive,
} = slice.actions;
export default slice.reducer;
