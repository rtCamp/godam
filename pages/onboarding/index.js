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
