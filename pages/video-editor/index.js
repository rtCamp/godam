/**
 * External dependencies
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { PostHogProvider } from '@posthog/react';

/**
 * Internal dependencies
 */
import store from './redux/store';
import App from './App';
import posthog from '../utils/posthog';
import LayerControls from './components/LayerControls';
import LayersHeader from './components/layers/LayersHeader';
import { updateLayerField } from './redux/slice/videoSlice';
import {
	VeSection,
	VeTextInput,
	VeSegmented,
	VeColorList,
	VeRadioGroup,
} from './components/controls';
import FontAwesomeIconPicker from './components/hotspot/FontAwesomeIconPicker';
import ColorPickerButton from './components/shared/color-picker/ColorPickerButton.jsx';
import { formatClock, parseClock } from './utils/time';
import { registerEditorLayerTypes } from './layers';
import { useLayer, useLayerAttributes } from './layers/hooks';

window.godamVideoEditorComponents = {
	...( window.godamVideoEditorComponents || {} ),
	LayerControls,
	LayersHeader,
	VeSection,
	VeTextInput,
	VeSegmented,
	VeColorList,
	VeRadioGroup,
	FontAwesomeIconPicker,
	ColorPickerButton,
};

window.godamVideoEditorActions = {
	...( window.godamVideoEditorActions || {} ),
	updateLayerField,
};

window.godamVideoEditorUtils = {
	...( window.godamVideoEditorUtils || {} ),
	formatClock,
	parseClock,
};

// Layer API (#2292): hooks and controls for layer settings panels, imported by
// add-ons as `@godam/layer-editor` (script handle `godam-layer-editor`).
window.godam = window.godam || {};
window.godam.layerEditor = {
	...( window.godam.layerEditor || {} ),
	useLayer,
	useLayerAttributes,
	LayerCanvas: LayerControls,
	LayersHeader,
	VeSection,
	VeTextInput,
	VeSegmented,
	VeColorList,
	VeRadioGroup,
	FontAwesomeIconPicker,
	ColorPickerButton,
	formatClock,
	parseClock,
};

// Core layer types, then add-on types described through the old PHP hooks.
// Add-ons on the Layer API register themselves through `window.godam.layers`.
registerEditorLayerTypes();

const Index = () => {
	return (
		<PostHogProvider client={ posthog }>
			<Provider store={ store }>
				<App />
			</Provider>
		</PostHogProvider>
	);
};

const root = ReactDOM.createRoot( document.getElementById( 'root-video-editor' ) );
root.render( <Index /> );

