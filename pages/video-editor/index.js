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

window.godamVideoEditorComponents = {
	...( window.godamVideoEditorComponents || {} ),
	LayerControls,
	LayersHeader,
};

window.godamVideoEditorActions = {
	...( window.godamVideoEditorActions || {} ),
	updateLayerField,
};

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

