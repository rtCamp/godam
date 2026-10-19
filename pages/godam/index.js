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
import MarketoSettings from './components/tabs/IntegrationsSettings/MarketoSettings.jsx';

import './index.scss';

// Register core integration settings components on the shared seam that
// `IntegrationsSettings` reads (`window.godamIntegrationComponents[ name ]`).
// Marketo ships in core, so it registers here rather than from an add-on.
window.godamIntegrationComponents = {
	...( window.godamIntegrationComponents || {} ),
	marketo: MarketoSettings,
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

const rootElement = document.getElementById( 'root-godam-settings' );

if ( rootElement ) {
	const root = ReactDOM.createRoot( rootElement );
	root.render( <Index /> );
}
