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

/**
 * Geist — the onboarding design font, self-hosted via @fontsource (latin subset,
 * the weights the UI uses). Declares font-family: 'Geist', which the SCSS stack
 * (--godam-onb-font) already targets.
 */
import '@fontsource/geist/latin-400.css';
import '@fontsource/geist/latin-500.css';
import '@fontsource/geist/latin-600.css';
import '@fontsource/geist/latin-700.css';

import './index.scss';

const Index = () => (
	<PostHogProvider client={ posthog }>
		<Provider store={ store }>
			<App />
		</Provider>
	</PostHogProvider>
);

const rootElement = document.getElementById( 'root-godam-onboarding' );

if ( rootElement ) {
	const root = ReactDOM.createRoot( rootElement );
	root.render( <Index /> );
}
